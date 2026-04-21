"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, BookOpen, UserPlus, Users, Play,
  ChevronRight, Plus, Loader2, GraduationCap, Award, ExternalLink,
  Search, Bell, Settings, Globe, LogOut, User, ChevronDown,
  CheckSquare, Square, X, BookMarked, Pencil, Image, Target, Heart,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { ProgressBar } from "@/components/course/ProgressBar";
import { api } from "@/lib/api";

interface Child {
  id: string;
  full_name: string;
  full_name_bn: string | null;
  grade: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
}

interface EnrollmentItem {
  enrollment_id: string;
  course_id: string;
  course_title: string;
  course_title_bn: string | null;
  course_thumbnail: string | null;
  course_type: string;
  total_lessons: number;
  progress_pct: number;
  enrolled_at: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, accessToken, _hasHydrated, logout } = useAuthStore();
  const { locale, setLocale, t } = useLocaleStore();
  const [children, setChildren] = useState<Child[]>([]);
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [addingChild, setAddingChild] = useState(false);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Course assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetChild, setAssignTargetChild] = useState<Child | null>(null);
  const [assignableCourses, setAssignableCourses] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [childAlreadyAssignedIds, setChildAlreadyAssignedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Unassigned purchases (NULL child entitlements)
  const [unassignedPurchases, setUnassignedPurchases] = useState<any[]>([]);
  // ALL purchased courses (for "add to another child" feature)
  const [allPurchasedCourses, setAllPurchasedCourses] = useState<any[]>([]);

  const MAX_CHILDREN = 2;

  useEffect(() => { setMounted(true); }, []);

  // Auth guard + load data — wait for hydration and token
  useEffect(() => {
    if (!mounted || !_hasHydrated) return;

    // Read directly from store to avoid stale closure after navigation
    const state = useAuthStore.getState();
    const token = state.accessToken || accessToken;
    const authed = state.isAuthenticated || isAuthenticated;

    if (!authed || !token) {
      router.push("/login");
      return;
    }
    if (user?.roles?.some((r: string) => ["super_admin", "admin"].includes(r))) { router.push("/admin"); return; }

    const load = async () => {
      try {
        const data: any = await api.get("/children/", token!);
        setChildren(data);
        if (data.length > 0) setActiveChild(data[0]);
      } catch {}

      // Load all purchased course entitlements
      try {
        const ents: any = await api.get("/orders/my/entitlements?entitlement_type=course_access", token!);
        const allEnts = Array.isArray(ents) ? ents : [];
        const unassigned = allEnts.filter(
          (e: any) => e.child_profile_id === null || e.child_profile_id === undefined
        );
        setUnassignedPurchases(unassigned);

        // Deduplicate by product_id to get unique purchased courses
        const seen = new Set<string>();
        const uniqueCourses = allEnts.filter((e: any) => {
          if (seen.has(e.product_id)) return false;
          seen.add(e.product_id);
          return true;
        });
        setAllPurchasedCourses(uniqueCourses);
      } catch {}

      setLoading(false);
    };
    load();
  }, [mounted, _hasHydrated, isAuthenticated, accessToken, user, router]);

  // Load certificates
  useEffect(() => {
    if (!accessToken) return;
    const loadCerts = async () => {
      try {
        const data: any = await api.get("/certificates/my", accessToken);
        setCertificates(data || []);
      } catch {}
    };
    loadCerts();
  }, [accessToken]);

  // Load enrollments when child changes
  useEffect(() => {
    if (!activeChild || !accessToken) return;
    const load = async () => {
      try {
        const data: any = await api.get(`/progress/children/${activeChild.id}/enrollments`, accessToken);
        setEnrollments(Array.isArray(data) ? data : Array.isArray(data?.enrollments) ? data.enrollments : []);
      } catch { setEnrollments([]); }
    };
    load();
  }, [activeChild, accessToken]);

  // Load exams when child changes
  useEffect(() => {
    if (!activeChild || !accessToken) return;
    api.get(`/exams/my?child_profile_id=${activeChild.id}`, accessToken)
      .then((data: any) => setExams(Array.isArray(data) ? data : []))
      .catch(() => setExams([]));
  }, [activeChild, accessToken]);

  const handleAddChild = async () => {
    if (!newChildName.trim() || !accessToken) return;
    setAddingChild(true);
    try {
      const child: any = await api.post("/children/", { full_name: newChildName }, accessToken);
      const newChild: Child = {
        id: child.id,
        full_name: child.full_name,
        full_name_bn: child.full_name_bn,
        grade: child.grade,
        avatar_url: child.avatar_url,
        date_of_birth: child.date_of_birth,
        gender: null,
      };
      setChildren((prev) => [...prev, newChild]);
      if (!activeChild) setActiveChild(newChild);
      setNewChildName("");
      setShowAddChild(false);

      // If there are unassigned courses, show the assignment modal
      if (child.unassigned_courses && child.unassigned_courses.length > 0) {
        setAssignTargetChild(newChild);
        setAssignableCourses(child.unassigned_courses);
        // Pre-select all courses by default
        setSelectedProductIds(new Set(child.unassigned_courses.map((c: any) => c.product_id)));
        setAssignModalOpen(true);
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Maximum")) {
        import("@/stores/toast-store").then((m) =>
          m.toast.error(t("সর্বোচ্চ ২টি সন্তানের প্রোফাইল তৈরি করা যাবে", "Maximum 2 child profiles allowed"))
        );
      }
    }
    setAddingChild(false);
  };

  const handleAssignCourses = async () => {
    if (!assignTargetChild || !accessToken) return;
    setAssigning(true);
    try {
      await api.post(
        `/children/${assignTargetChild.id}/assign-courses`,
        { product_ids: Array.from(selectedProductIds) },
        accessToken,
      );
      // Refresh enrollments if this child is already active
      if (activeChild?.id === assignTargetChild.id) {
        const data: any = await api.get(`/progress/children/${assignTargetChild.id}/enrollments`, accessToken);
        setEnrollments(Array.isArray(data) ? data : Array.isArray(data?.enrollments) ? data.enrollments : []);
      }
      // Re-fetch all entitlements so both the banner and 'Add Course' button update
      try {
        const ents: any = await api.get("/orders/my/entitlements?entitlement_type=course_access", accessToken);
        const allEnts = Array.isArray(ents) ? ents : [];
        const unassigned = allEnts.filter(
          (e: any) => e.child_profile_id === null || e.child_profile_id === undefined
        );
        setUnassignedPurchases(unassigned);

        const seen = new Set<string>();
        const uniqueCourses = allEnts.filter((e: any) => {
          if (seen.has(e.product_id)) return false;
          seen.add(e.product_id);
          return true;
        });
        setAllPurchasedCourses(uniqueCourses);
      } catch {}
    } catch {}
    setAssigning(false);
    setAssignModalOpen(false);
    setAssignTargetChild(null);
    setAssignableCourses([]);
  };

  // Open the assignment modal for a specific child (used from banner / manage button)
  const openAssignModal = async (child: Child, courses?: any[]) => {
    const coursesToAssign = courses ?? unassignedPurchases.map((e: any) => ({
      entitlement_id: e.id,
      product_id: e.product_id,
      product_title: e.product_title,
      product_title_bn: null,
      thumbnail_url: null,
    }));
    setAssignTargetChild(child);
    setAssignableCourses(coursesToAssign);
    setAssignModalOpen(true);
    setModalLoading(true);
    setChildAlreadyAssignedIds(new Set());

    // Fetch what's already assigned to this child
    try {
      const allEnts: any = await api.get("/orders/my/entitlements?entitlement_type=course_access", accessToken ?? undefined);
      const alreadyAssigned = new Set<string>(
        (Array.isArray(allEnts) ? allEnts : [])
          .filter((e: any) => e.child_profile_id === child.id)
          .map((e: any) => e.product_id as string)
      );
      setChildAlreadyAssignedIds(alreadyAssigned);
      // Pre-select only the ones NOT yet assigned
      setSelectedProductIds(
        new Set(coursesToAssign
          .filter((c: any) => !alreadyAssigned.has(c.product_id))
          .map((c: any) => c.product_id as string)
        )
      );
    } catch {
      // Fallback: pre-select all
      setSelectedProductIds(new Set(coursesToAssign.map((c: any) => c.product_id as string)));
    }
    setModalLoading(false);
  };

  // Open modal showing ALL purchased courses (for "add to another child")
  const openAssignModalAll = async (child: Child) => {
    const coursesToAssign = allPurchasedCourses.map((e: any) => ({
      entitlement_id: e.id,
      product_id: e.product_id,
      product_title: e.product_title,
      product_title_bn: null,
      thumbnail_url: null,
    }));
    setAssignTargetChild(child);
    setAssignableCourses(coursesToAssign);
    setAssignModalOpen(true);
    setModalLoading(true);
    setChildAlreadyAssignedIds(new Set());

    // Fetch what's already assigned to this child
    try {
      const allEnts: any = await api.get("/orders/my/entitlements?entitlement_type=course_access", accessToken ?? undefined);
      const alreadyAssigned = new Set<string>(
        (Array.isArray(allEnts) ? allEnts : [])
          .filter((e: any) => e.child_profile_id === child.id)
          .map((e: any) => e.product_id as string)
      );
      setChildAlreadyAssignedIds(alreadyAssigned);
      setSelectedProductIds(
        new Set(coursesToAssign
          .filter((c: any) => !alreadyAssigned.has(c.product_id))
          .map((c: any) => c.product_id as string)
        )
      );
    } catch {
      setSelectedProductIds(new Set(coursesToAssign.map((c: any) => c.product_id as string)));
    }
    setModalLoading(false);
  };

  const toggleCourseSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const activeCoursesCount = enrollments.filter(e => e.progress_pct < 100).length;
  const overallProgress = enrollments.length > 0 
    ? Math.round(enrollments.reduce((sum, e) => sum + e.progress_pct, 0) / enrollments.length) 
    : 0;

  const activeChildCertificates = certificates.filter(cert => 
    enrollments.some(e => e.course_id === cert.course_id)
  );

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-24 min-h-screen">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Application Header (Replacing Native Navbar) */}
      <div className="hidden lg:flex items-center justify-between pb-6 border-b border-gray-100 mb-8">
        <div className="flex gap-6 items-center">
          <div className="text-primary-700 font-bold border-b-2 border-primary-700 pb-1">
            {t("সন্তান:", "Child:")} {activeChild?.full_name_bn || activeChild?.full_name || t("নির্বাচন করুন", "Select")}
          </div>
          <div className="text-gray-500 font-semibold pb-1 hover:text-gray-800 cursor-pointer">
            {t("হেল্প সেন্টার", "Help Center")}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-semibold text-gray-600"
            title={locale === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
          >
            <Globe className="w-3.5 h-3.5" />
            {locale === "bn" ? "EN" : "বাং"}
          </button>
          
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder={t("রিসোর্স খুঁজুন...", "Search resources...")} className="pl-9 pr-4 py-2 bg-gray-50 rounded-full text-sm outline-none w-64 focus:bg-gray-100 transition-colors" />
          </div>

          {/* Notification Bell */}
          <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors group">
            <Bell className="w-5 h-5 text-gray-500 group-hover:text-primary-600 transition-colors" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center shadow-sm font-bold text-sm">
                {user?.full_name?.[0]}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 py-2 z-50 overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center shadow-sm font-bold">
                        {user?.full_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{user?.full_name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{user?.phone || user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1.5">
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      {t("প্রোফাইল", "Profile")}
                    </Link>
                    <Link
                      href="/dashboard/orders"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      {t("অর্ডার সমূহ", "My Orders")}
                    </Link>
                    <Link
                      href="/dashboard/certificates"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Award className="w-4 h-4 text-gray-400" />
                      {t("সার্টিফিকেট", "Certificates")}
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-50 pt-1.5">
                    <button
                      onClick={() => {
                        logout();
                        setProfileOpen(false);
                        window.location.href = "/";
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t("লগআউট", "Logout")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unassigned Purchases Banner */}
      {unassignedPurchases.length > 0 && children.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-200/70">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900 font-bn">
                {t(
                  `${unassignedPurchases.length}টি ক্রয়কৃত কোর্স কোনো সন্তানের সাথে যুক্ত নেই`,
                  `${unassignedPurchases.length} purchased course${unassignedPurchases.length > 1 ? 's' : ''} not assigned to any child`
                )}
              </p>
              <p className="text-xs text-amber-700 mt-0.5 font-bn">
                {t("নিচের বাটনে ক্লিক করে সন্তানের সাথে যুক্ত করুন", "Click below to assign them to a child profile")}
              </p>
            </div>
          </div>

          {/* Unassigned course chips */}
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {unassignedPurchases.map((ent: any) => (
              <div key={ent.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 rounded-full">
                <BookMarked className="w-3 h-3 text-amber-600" />
                <span className="text-xs font-semibold text-amber-900 font-bn max-w-[180px] truncate">
                  {ent.product_title}
                </span>
              </div>
            ))}
          </div>

          {/* Assign buttons — one per child */}
          <div className="px-5 pb-4 flex flex-wrap gap-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => openAssignModal(child)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white text-xs font-bold rounded-xl hover:bg-amber-800 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t(`${child.full_name_bn || child.full_name}-এ যোগ করো`, `Assign to ${child.full_name}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Welcome & Child Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            {t("স্বাগতম,", "Welcome,")} {user?.full_name}
          </h1>
          <p className="text-gray-500 font-semibold mt-1">
            {t("আপনার সন্তানের অগ্রগতি রিয়েল-টাইমে ট্র্যাক করা হচ্ছে।", "Your children's academic progress is tracked in real-time.")}
          </p>
        </div>

        {/* Floating Child Switcher Pill */}
        <div className="flex items-center bg-white rounded-full p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-gray-100">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => setActiveChild(child)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-bold text-sm ${
                activeChild?.id === child.id 
                  ? "bg-primary-50/50 text-gray-900" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {activeChild?.id === child.id && (
                <div className="w-2 h-2 rounded-full bg-primary-600" />
              )}
              {child.full_name_bn || child.full_name.split(' ')[0]}
            </button>
          ))}
          {/* Only show add button if under the max limit */}
          {children.length < MAX_CHILDREN && (
            <button 
              onClick={() => setShowAddChild(!showAddChild)}
              className="w-8 h-8 ml-1 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
              title={t("সন্তান যোগ করুন", "Add child")}
            >
              <Plus className="w-4 h-4 font-bold" />
            </button>
          )}
          {/* Manage courses button — opens assignment modal for active child */}
          {activeChild && unassignedPurchases.length > 0 && (
            <button
              onClick={() => openAssignModal(activeChild)}
              className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold hover:bg-amber-200 transition-colors"
              title={t("অ্যাসাইন করা হয়নি এমন কোর্স যোগ করুন", "Assign unassigned courses")}
            >
              <BookOpen className="w-3 h-3" />
              {unassignedPurchases.length}
            </button>
          )}
          {children.length >= MAX_CHILDREN && unassignedPurchases.length === 0 && (
            <span className="ml-2 px-2 py-1 text-[10px] font-bold text-gray-400 bg-gray-50 rounded-full">
              {t("সর্বোচ্চ ২", "Max 2")}
            </span>
          )}
        </div>
      </div>

      {/* Add Child Form Dropdown */}
      {showAddChild && (
        <div className="mb-8 p-4 rounded-3xl bg-white shadow-lg border border-primary-100 max-w-sm ml-auto">
          <input type="text" value={newChildName} onChange={(e) => setNewChildName(e.target.value)} placeholder={t("নতুন সন্তানের নাম", "Child's Name")} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bn mb-3 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 bg-gray-50" />
          <div className="flex gap-2">
            <button onClick={handleAddChild} disabled={addingChild} className="flex-1 py-2.5 bg-primary-700 text-white text-sm font-bold rounded-xl hover:bg-primary-800 disabled:opacity-50">
              {addingChild ? t("যোগ করা হচ্ছে...", "Adding...") : t("সংযুক্ত করুন", "Add Child")}
            </button>
            <button onClick={() => setShowAddChild(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200">
              {t("বাতিল", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Grid Layout containing Main Left (Stats + Courses) and Right Sidebar */}
      {activeChild ? (
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Main Content Area (Left 8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Massive Stats Banner */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-50 p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-48 h-48 bg-primary-50 rounded-full blur-3xl -mr-24 -mt-24 opacity-50" />
              
              <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-primary-100 shrink-0 shadow-sm relative z-10 bg-primary-50 flex items-center justify-center">
                {activeChild.avatar_url ? (
                  <img src={activeChild.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-primary-300">
                    {(activeChild.full_name_bn || activeChild.full_name)[0]}
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-row items-center justify-around w-full relative z-10 gap-4">
                <div className="text-center">
                  <h3 className="text-gray-500 font-bold text-sm mb-1">{t("অ্যাক্টিভ কোর্স", "Active Courses")}</h3>
                  <p className="text-4xl font-black text-primary-800">{activeCoursesCount}</p>
                </div>
                
                <div className="text-center w-40">
                  <h3 className="text-gray-500 font-bold text-sm mb-1">{t("পড়াশোনার উন্নতি", "Overall Progress")}</h3>
                  <div className="flex items-end justify-center gap-2 mb-2">
                    <p className="text-4xl font-black text-primary-800">{overallProgress}%</p>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-800 rounded-full" style={{ width: `${overallProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Courses Section Header */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-extrabold text-gray-900">
                {t("কোর্স সমূহ", "Courses")}
              </h2>
              {activeChild && allPurchasedCourses.length > 0 && (
                <button
                  onClick={() => openAssignModalAll(activeChild)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-50 text-primary-700 text-xs font-bold rounded-xl hover:bg-primary-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("কোর্স যোগ করুন", "Add Course")}
                </button>
              )}
            </div>

            {/* Courses Grid */}
            <div className="grid md:grid-cols-2 gap-5">
              {enrollments.length === 0 ? (
                <div className="md:col-span-2 bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-50">
                  <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-400">{t("এখনো কোনো কোর্সে ভর্তি হয়নি", "No active courses yet")}</h3>
                  <Link href="/courses" className="mt-4 inline-flex items-center py-2.5 px-6 bg-primary-700 text-white font-bold rounded-xl text-sm hover:bg-primary-800 shadow-md">
                    {t("কোর্স দেখুন", "Explore Courses")}
                  </Link>
                </div>
              ) : (
                enrollments.map((e) => {
                  const isCompleted = e.progress_pct === 100;
                  return (
                    <Link key={e.enrollment_id} href={`/learn/${e.course_id}?child=${activeChild.id}`} className="group bg-white rounded-2xl border border-gray-50 overflow-hidden shadow-[0_2px_12px_rgb(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] transition-all flex flex-col p-3 pb-4">
                      <div className="relative h-36 rounded-xl overflow-hidden mb-3 bg-gray-100 flex items-center justify-center">
                        {e.course_thumbnail ? (
                          <img src={e.course_thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <Play className="w-10 h-10 text-gray-300" />
                        )}
                        <div className="absolute top-2 left-2 px-2.5 py-0.5 bg-white/90 backdrop-blur-sm shadow-sm rounded-full text-[9px] font-black tracking-widest uppercase text-primary-900 border border-white/20">
                          {e.course_type}
                        </div>
                      </div>
                      <div className="px-2 flex-1 flex flex-col">
                        <h3 className="font-bold text-gray-900 text-[15px] line-clamp-2 leading-snug mb-auto group-hover:text-primary-700 transition-colors">
                          {locale === "bn" && e.course_title_bn ? e.course_title_bn : e.course_title}
                        </h3>

                        <div className="mt-4">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] font-bold text-gray-500">Progress</span>
                            <span className={`text-[11px] font-black ${isCompleted ? 'text-green-600' : 'text-primary-700'}`}>
                              {isCompleted ? t('সম্পন্ন', 'Completed') : `${e.progress_pct}%`}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-primary-800'}`} style={{ width: `${e.progress_pct}%` }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Exams Section Header */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary-700" />
                <span className="font-bn">{t("আমার পরীক্ষাসমূহ", "My Exams")}</span>
              </h2>
            </div>

            {/* Exams Grid */}
            <div className="grid md:grid-cols-2 gap-5">
              {exams.length === 0 ? (
                <div className="md:col-span-2 bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-50">
                  <GraduationCap className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-400 font-bn">{t("কোনো পরীক্ষা নেই", "No exams yet")}</h3>
                </div>
              ) : (
                exams.map((exam) => {
                  const bestAttempt = exam.attempts && exam.attempts.length > 0
                    ? exam.attempts.reduce((best: any, a: any) => (parseFloat(a.score) > parseFloat(best.score) ? a : best), exam.attempts[0])
                    : null;
                  return (
                    <div key={exam.id} className="group bg-white rounded-2xl border border-gray-50 overflow-hidden shadow-[0_2px_12px_rgb(0,0,0,0.02)] hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] transition-all flex flex-col p-3 pb-4">
                      <div className="relative h-36 rounded-xl overflow-hidden mb-3 bg-gray-100 flex items-center justify-center">
                        {exam.thumbnail_url ? (
                          <img src={exam.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <GraduationCap className="w-10 h-10 text-gray-300" />
                        )}
                        <div className={`absolute top-2 left-2 px-2.5 py-0.5 backdrop-blur-sm shadow-sm rounded-full text-[9px] font-black tracking-widest uppercase border border-white/20 ${
                          exam.exam_type === "scheduled"
                            ? "bg-amber-50/90 text-amber-900"
                            : "bg-white/90 text-primary-900"
                        }`}>
                          {exam.exam_type === "scheduled" ? t("নির্ধারিত", "Scheduled") : t("যেকোনো সময়", "Anytime")}
                        </div>
                      </div>
                      <div className="px-2 flex-1 flex flex-col">
                        <Link href={`/exams/${exam.slug}`} className="font-bold text-gray-900 text-[15px] line-clamp-2 leading-snug mb-2 group-hover:text-primary-700 transition-colors font-bn">
                          {locale === "bn" && exam.title_bn ? exam.title_bn : exam.title}
                        </Link>

                        <div className="flex items-center gap-3 text-[11px] text-gray-500 font-bold mb-3">
                          <span>{exam.total_sections} {t("সেকশন", "sections")}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span>{exam.total_questions} {t("প্রশ্ন", "questions")}</span>
                          {exam.time_limit_seconds && (
                            <>
                              <span className="w-1 h-1 bg-gray-300 rounded-full" />
                              <span>{Math.floor(exam.time_limit_seconds / 60)} {t("মিনিট", "min")}</span>
                            </>
                          )}
                        </div>

                        {exam.exam_type === "scheduled" && exam.scheduled_start && (
                          <div className="text-[11px] text-amber-700 font-bold mb-3 font-bn">
                            {t("সময়সূচী:", "Scheduled:")} {new Date(exam.scheduled_start).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}

                        <div className="mt-auto flex items-center justify-between">
                          {bestAttempt ? (
                            <div className={`flex items-center gap-1.5 text-[11px] font-black ${bestAttempt.passed ? 'text-green-600' : 'text-red-500'}`}>
                              <Award className="w-3.5 h-3.5" />
                              <span>{t("সর্বোচ্চ স্কোর:", "Best:")} {parseFloat(bestAttempt.score).toFixed(0)}%</span>
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-black ${bestAttempt.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                {bestAttempt.passed ? t("পাস", "Pass") : t("ফেইল", "Fail")}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-bold font-bn">{t("এখনো চেষ্টা করা হয়নি", "Not attempted")}</span>
                          )}
                          <Link
                            href={`/exams/${exam.slug}/take?child=${activeChild.id}&examId=${exam.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-700 text-white text-[11px] font-bold rounded-lg hover:bg-primary-800 transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            {t("শুরু করুন", "Take")}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-5">

            {/* Drawings & Challenges Card — Coming Soon */}
            <div className="bg-gradient-to-br from-pink-600 to-purple-700 rounded-2xl p-5 text-white relative overflow-hidden shadow-lg shadow-pink-700/10 group">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-purple-500/40 rounded-full blur-2xl" />

              {/* Blurred Overlay */}
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-pink-900/40 backdrop-blur-[2px] transition-all">
                <div className="bg-white/10 border border-white/20 px-4 py-3 rounded-xl backdrop-blur-md shadow-xl flex flex-col items-center transform transition-transform group-hover:scale-105">
                  <div className="w-8 h-8 bg-pink-500/20 rounded-full flex items-center justify-center mb-1.5 border border-pink-400/50">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-pulse" />
                  </div>
                  <h3 className="font-black text-xl font-bn text-white tracking-wide">{t("শীঘ্রই আসছে", "Coming Soon")}</h3>
                  <p className="text-pink-100 font-bn text-[11px] mt-0.5">{t("এই ফিচার অতি শীঘ্রই আসছে", "This feature will be available shortly")}</p>
                </div>
              </div>

              {/* Mock Content underneath */}
              <div className="relative z-10 opacity-60">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <Pencil className="w-4 h-4" />
                    <span className="font-bn">{t("আঁকা ও চ্যালেঞ্জ", "Art & Challenges")}</span>
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                      <Pencil className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white/80 font-bn">{t("মুক্ত আঁকা", "Free Draw")}</span>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                      <Image className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white/80 font-bn">{t("আমার ছবি", "My Drawings")}</span>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white/80 font-bn">{t("চ্যালেঞ্জ", "Challenges")}</span>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-white/80 font-bn">{t("গ্যালারি", "Gallery")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgb(0,0,0,0.02)] border border-gray-50">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-extrabold text-gray-900 text-base">{t("সাম্প্রতিক কার্যকলাপ", "Recent Activity")}</h3>
                <button className="text-gray-400 hover:text-gray-600">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-current rounded-full" />
                    <div className="w-1 h-1 bg-current rounded-full" />
                    <div className="w-1 h-1 bg-current rounded-full" />
                  </div>
                </button>
              </div>

              <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[0.95rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-gray-100 before:to-transparent">
                {/* Mocked activity stream matching design */}
                <div className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full border-4 border-white bg-primary-100 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10 transition-colors mt-0.5">
                    <GraduationCap className="w-3 h-3 text-primary-700" />
                  </div>
                  <div className="w-full md:w-[calc(100%-2rem)] ml-3 md:ml-0 md:group-odd:pr-6 md:group-even:pl-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm">{t("কোর্সে ভর্তি হয়েছে", "Course Enrolled")}</span>
                      <span className="text-[11px] text-gray-400 mt-0.5">{(locale === "bn" && enrollments[0]?.course_title_bn) || enrollments[0]?.course_title || t('কোনো কোর্স নেই', 'No recent courses')} • {t("আজকে", "Today")}</span>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full border-4 border-white bg-amber-50 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10 mt-0.5">
                    <Award className="w-3 h-3 text-amber-600" />
                  </div>
                  <div className="w-full md:w-[calc(100%-2rem)] ml-3 md:ml-0 md:group-odd:pr-6 md:group-even:pl-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm">{t("সার্টিফিকেট অর্জন", "Certificates Earned")}</span>
                      <span className="text-[11px] text-gray-400 mt-0.5">{activeChildCertificates.length} {t("টি সার্টিফিকেট আনলক", "certificates unlocked")} • {t("হিস্টরি", "History")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center border-t border-gray-50 pt-4">
                <button className="text-[11px] font-bold text-primary-700 hover:text-primary-800 px-4 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors">
                  {t("পারফরম্যান্স হিস্টরি দেখুন", "View Performance History")}
                </button>
              </div>
            </div>

            {/* Live Session Promo Card - Upcoming Feature */}
            <div className="bg-primary-700 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg shadow-primary-700/10 group">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-primary-500/40 rounded-full blur-2xl" />
              
              {/* Blurred Overlay */}
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-primary-900/40 backdrop-blur-[2px] transition-all">
                <div className="bg-white/10 border border-white/20 px-4 py-3 rounded-xl backdrop-blur-md shadow-xl flex flex-col items-center transform transition-transform group-hover:scale-105">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center mb-1.5 border border-amber-400/50">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  </div>
                  <h3 className="font-black text-xl font-bn text-white tracking-wide">{t("শীঘ্রই আসছে", "Coming Soon")}</h3>
                  <p className="text-primary-100 font-bn text-[11px] mt-0.5">{t("এই ফিচার অতি শীঘ্রই আসছে", "This feature will be available shortly")}</p>
                </div>
              </div>

              {/* Mock Content underneath */}
              <div className="relative z-10 opacity-60">
                <h3 className="font-black font-bn text-xl mb-1">{t("আজকের লাইভ সেশন", "Live Session Today")}</h3>
                <p className="text-primary-100 font-bn text-xs leading-relaxed mb-5">
                  {t("বেসিক ক্লিয়ারেন্স ক্লাস - সরাসরি জুম সেশন!", "Mastering Fundamentals - Immersive Live Session!")}
                </p>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary-300 border-2 border-primary-700 flex items-center justify-center font-bold text-[10px]">+১২</div>
                    <div className="w-8 h-8 rounded-full bg-primary-400 border-2 border-primary-700" />
                    <div className="w-8 h-8 rounded-full bg-amber-400 border-2 border-primary-700" />
                  </div>
                  <div className="px-3 py-1.5 bg-white/10 rounded-full text-[10px] font-bold font-bn w-fit border border-white/10">
                    {locale === "bn" ? "বিকাল ৩:০০" : "14:00 PM"}
                  </div>
                </div>

                <div className="w-full py-2.5 bg-white/10 text-white/50 border border-white/20 rounded-xl font-black font-bn text-xs text-center">
                  {t("ক্লাসরুমে যোগ দিন", "Join Classroom")}
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-gray-50 p-16 text-center shadow-sm">
          <Users className="w-20 h-20 text-gray-200 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-gray-400">{t("প্রথমে সন্তানের প্রোফাইল যোগ করো", "Add a child profile first")}</h3>
          <p className="text-gray-400 mt-2">{t("উপরের ডানদিকের প্লাস বোতামটি ব্যবহার করে সন্তান যোগ করুন।", "Use the plus button on the top right to add a child.")}</p>
        </div>
      )}

      {/* Course Assignment Modal */}
      {assignModalOpen && assignTargetChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAssignModalOpen(false)} />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 px-6 pt-6 pb-8">
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary-400/20 rounded-full blur-xl" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white leading-tight">
                      {t("কোর্স অ্যাসাইন করুন", "Assign Courses")}
                    </h2>
                    <p className="text-primary-100 text-sm mt-0.5 font-bn">
                      <span className="font-bold text-white">{assignTargetChild.full_name}</span>
                      {t("-এর জন্য কোর্স বেছে নিন", " — choose courses to assign")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center hover:bg-white/25 transition-colors shrink-0"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Status badges */}
              <div className="relative mt-4 flex items-center flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 border border-white/20 rounded-full">
                  <BookOpen className="w-3.5 h-3.5 text-primary-100" />
                  <span className="text-xs font-bold text-white">
                    {assignableCourses.length} {t("টি কোর্স", "courses")}
                  </span>
                </div>
                {childAlreadyAssignedIds.size > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/30 border border-green-400/40 rounded-full">
                    <CheckSquare className="w-3.5 h-3.5 text-green-200" />
                    <span className="text-xs font-bold text-white">
                      {childAlreadyAssignedIds.size} {t("টি আগেই যোগ করা হয়েছে", "already assigned")}
                    </span>
                  </div>
                )}
                {selectedProductIds.size > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 border border-white/30 rounded-full">
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span className="text-xs font-bold text-white">
                      {selectedProductIds.size} {t("টি নতুন যোগ হবে", "new to assign")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Instruction */}
            <div className="px-6 pt-4 pb-2">
              <p className="text-sm text-gray-500 font-bn leading-relaxed">
                {t(
                  "সবুজ চিহ্নিত কোর্সগুলো ইতিমধ্যে এই সন্তানের সাথে যুক্ত। বাকিগুলো থেকে নতুন কোর্স বেছে নিন।",
                  "Courses marked green are already assigned to this child. Select any remaining ones to add."
                )}
              </p>
            </div>

            {/* Course Cards */}
            <div className="px-6 pb-4">
              {modalLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1 mt-3">
                  {assignableCourses.map((course: any) => {
                    const isAlreadyAssigned = childAlreadyAssignedIds.has(course.product_id);
                    const isSelected = selectedProductIds.has(course.product_id);

                    return (
                      <button
                        key={course.product_id}
                        onClick={() => !isAlreadyAssigned && toggleCourseSelection(course.product_id)}
                        disabled={isAlreadyAssigned}
                        className={`w-full flex items-stretch gap-0 rounded-2xl border-2 text-left transition-all overflow-hidden ${
                          isAlreadyAssigned
                            ? "border-green-300 bg-green-50 cursor-default opacity-90"
                            : isSelected
                            ? "border-primary-400 shadow-sm shadow-primary-100"
                            : "border-gray-200 bg-white hover:border-gray-300 cursor-pointer"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className={`w-24 shrink-0 relative overflow-hidden ${
                          isAlreadyAssigned
                            ? "bg-gradient-to-br from-green-100 to-green-200"
                            : "bg-gradient-to-br from-primary-100 to-primary-200"
                        }`}>
                          {course.thumbnail_url ? (
                            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookMarked className={`w-8 h-8 ${isAlreadyAssigned ? "text-green-400" : "text-primary-400"}`} />
                            </div>
                          )}
                          {isAlreadyAssigned && (
                            <div className="absolute inset-0 bg-green-600/15" />
                          )}
                          {isSelected && !isAlreadyAssigned && (
                            <div className="absolute inset-0 bg-primary-600/20" />
                          )}
                        </div>

                        {/* Course info */}
                        <div className="flex-1 px-4 py-3 flex flex-col justify-center min-w-0">
                          <p className="text-sm font-bold text-gray-900 font-bn leading-snug line-clamp-2">
                            {course.product_title_bn || course.product_title}
                          </p>
                          {course.product_title_bn && course.product_title && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                              {course.product_title}
                            </p>
                          )}
                          {/* Already assigned badge */}
                          {isAlreadyAssigned && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 border border-green-200 rounded-full">
                                <CheckSquare className="w-3 h-3 text-green-600" />
                                <span className="text-[10px] font-bold text-green-700 font-bn">
                                  {t("ইতিমধ্যে যোগ করা হয়েছে", "Already assigned")}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Check indicator */}
                        <div className="px-4 flex items-center shrink-0">
                          {isAlreadyAssigned ? (
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                              <CheckSquare className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                              <CheckSquare className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-all font-bn"
              >
                {t("বন্ধ করুন", "Close")}
              </button>
              <button
                onClick={handleAssignCourses}
                disabled={assigning || selectedProductIds.size === 0 || modalLoading}
                className="flex-1 py-3 bg-primary-700 text-white font-bold rounded-xl text-sm hover:bg-primary-800 disabled:opacity-50 transition-all font-bn flex items-center justify-center gap-2"
              >
                {assigning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckSquare className="w-4 h-4" />
                )}
                {selectedProductIds.size === 0
                  ? t("সব কোর্স যোগ আছে", "All assigned")
                  : t("নিশ্চিত করুন", "Confirm & Assign")}
                {selectedProductIds.size > 0 && !assigning && (
                  <span className="w-5 h-5 rounded-full bg-white/25 text-xs flex items-center justify-center font-black">
                    {selectedProductIds.size}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
