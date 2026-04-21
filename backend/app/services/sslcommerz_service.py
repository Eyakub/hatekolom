"""
SSLCommerz Payment Gateway Integration.

Handles session initiation, IPN validation, and transaction verification.
Uses SSLCommerz REST API via httpx.

Sandbox: https://sandbox.sslcommerz.com
Production: https://securepay.sslcommerz.com
"""

import logging
import hashlib
from decimal import Decimal
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SANDBOX_URL = "https://sandbox.sslcommerz.com"
PRODUCTION_URL = "https://securepay.sslcommerz.com"


class SSLCommerzError(Exception):
    """Raised when SSLCommerz API returns an error."""
    pass


class SSLCommerzService:
    """SSLCommerz payment gateway client."""

    @staticmethod
    def _base_url() -> str:
        return SANDBOX_URL if settings.SSLCOMMERZ_SANDBOX else PRODUCTION_URL

    @staticmethod
    async def init_payment(
        order_number: str,
        amount: Decimal,
        currency: str,
        customer_name: str,
        customer_phone: str,
        customer_email: Optional[str] = None,
        product_name: str = "LMS Course",
        tran_id: Optional[str] = None,
    ) -> dict:
        """
        Initiate a payment session with SSLCommerz.
        
        Returns:
            dict with 'GatewayPageURL' to redirect the user to,
            or raises SSLCommerzError on failure.
        """
        base_url = SSLCommerzService._base_url()
        api_url = f"{base_url}/gwprocess/v4/api.php"

        payload = {
            "store_id": settings.SSLCOMMERZ_STORE_ID,
            "store_passwd": settings.SSLCOMMERZ_STORE_PASSWORD,
            "total_amount": str(amount),
            "currency": currency or "BDT",
            "tran_id": tran_id or order_number,
            "success_url": settings.SSLCOMMERZ_SUCCESS_URL,
            "fail_url": settings.SSLCOMMERZ_FAIL_URL,
            "cancel_url": settings.SSLCOMMERZ_CANCEL_URL,
            "ipn_url": settings.SSLCOMMERZ_IPN_URL,
            # Customer info
            "cus_name": customer_name or "Customer",
            "cus_email": customer_email or "no-email@example.com",
            "cus_phone": customer_phone or "01700000000",
            "cus_add1": "Bangladesh",
            "cus_city": "Dhaka",
            "cus_country": "Bangladesh",
            # Product info
            "product_name": product_name,
            "product_category": "Education",
            "product_profile": "non-physical-goods",
            # Shipping (not needed for digital goods)
            "shipping_method": "NO",
            "num_of_item": "1",
        }

        logger.info(f"Initiating SSLCommerz session for tran_id={payload['tran_id']}, amount={amount}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, data=payload)
            data = response.json()

        if data.get("status") == "SUCCESS":
            logger.info(f"SSLCommerz session created: {data.get('sessionkey', 'N/A')}")
            return {
                "status": "SUCCESS",
                "gateway_url": data["GatewayPageURL"],
                "session_key": data.get("sessionkey"),
                "tran_id": payload["tran_id"],
                "redirectGatewayURL": data.get("redirectGatewayURL"),
            }
        else:
            error_msg = data.get("failedreason", "Unknown SSLCommerz error")
            logger.error(f"SSLCommerz init failed: {error_msg}")
            raise SSLCommerzError(error_msg)

    @staticmethod
    async def validate_payment(val_id: str) -> dict:
        """
        Validate a payment using SSLCommerz Validation API.
        Called after receiving IPN or success callback.
        
        Returns the full validation response dict.
        """
        base_url = SSLCommerzService._base_url()
        api_url = f"{base_url}/validator/api/validationserverAPI.php"

        params = {
            "val_id": val_id,
            "store_id": settings.SSLCOMMERZ_STORE_ID,
            "store_passwd": settings.SSLCOMMERZ_STORE_PASSWORD,
            "format": "json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(api_url, params=params)
            data = response.json()

        logger.info(f"SSLCommerz validation for val_id={val_id}: status={data.get('status')}")
        return data

    @staticmethod
    def verify_ipn_hash(post_data: dict) -> bool:
        """
        Verify the hash sent by SSLCommerz in IPN callbacks.
        This ensures the callback is genuinely from SSLCommerz.
        """
        verify_sign = post_data.get("verify_sign")
        verify_key = post_data.get("verify_key")

        if not verify_sign or not verify_key:
            return False

        # Build the hash string from verify_key fields
        key_fields = verify_key.split(",")
        hash_string = ""
        for key in key_fields:
            if key == "store_passwd":
                # Use MD5 of store password
                val = hashlib.md5(
                    settings.SSLCOMMERZ_STORE_PASSWORD.encode()
                ).hexdigest()
            else:
                val = post_data.get(key, "")
            hash_string += f"{key}={val}&"

        # Remove trailing &
        hash_string = hash_string.rstrip("&")
        generated_hash = hashlib.md5(hash_string.encode()).hexdigest()

        return generated_hash == verify_sign
