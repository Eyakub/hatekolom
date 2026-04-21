"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Play,
  FileText,
  ClipboardList,
  Lock,
  CheckCircle2,
  Circle,
} from "lucide-react";

interface LessonItem {
  id: string;
  title: string;
  title_bn: string | null;
  lesson_type: string;
  sort_order: number;
  duration_seconds: number | null;
  is_free: boolean;
  is_locked: boolean;
  is_completed: boolean;
  watch_seconds: number;
  last_position: number;
  has_video: boolean;
  content?: string | null;
  content_bn?: string | null;
  allow_submission?: boolean;
  allow_image_upload?: boolean;
  max_grade?: number;
}

interface ModuleItem {
  id: string;
  title: string;
  title_bn: string | null;
  sort_order: number;
  is_free: boolean;
  lessons: LessonItem[];
  total_lessons: number;
  completed_lessons: number;
}

interface CourseAccordionProps {
  modules: ModuleItem[];
  activeLessonId?: string;
  onLessonClick: (lesson: LessonItem) => void;
  locale?: "bn" | "en";
}

const LESSON_TYPE_ICONS: Record<string, typeof Play> = {
  video_lecture: Play,
  smart_note: FileText,
  assignment: ClipboardList,
  quiz: ClipboardList,
  live_session: Play,
};

const LESSON_TYPE_LABELS_BN: Record<string, string> = {
  video_lecture: "ভিডিও লেকচার",
  smart_note: "স্মার্ট নোট",
  assignment: "এসাইনমেন্ট",
  quiz: "কুইজ",
  live_session: "লাইভ সেশন",
};

const LESSON_TYPE_COLORS: Record<string, string> = {
  video_lecture: "text-blue-600 bg-blue-50",
  smart_note: "text-green-600 bg-green-50",
  assignment: "text-orange-600 bg-orange-50",
  quiz: "text-purple-600 bg-purple-50",
  live_session: "text-red-600 bg-red-50",
};

export function CourseAccordion({
  modules,
  activeLessonId,
  onLessonClick,
  locale = "bn",
}: CourseAccordionProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.length > 0 ? [modules[0].id] : [])
  );

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    return `${mins} মিনিট`;
  };

  return (
    <div className="space-y-4">
      {modules.map((module, moduleIndex) => {
        const isExpanded = expandedModules.has(module.id);
        const progressPct =
          module.total_lessons > 0
            ? (module.completed_lessons / module.total_lessons) * 100
            : 0;

        return (
          <div
            key={module.id}
            className="bg-transparent"
          >
            {/* Module Header */}
            <button
              onClick={() => toggleModule(module.id)}
              className="w-full flex items-center justify-between py-2 text-left group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 font-bn text-sm truncate group-hover:text-primary-700 transition-colors">
                    {locale === "bn" && module.title_bn
                      ? module.title_bn
                      : module.title}
                    <span className="text-gray-400 font-normal ml-2 text-xs hidden sm:inline-block">
                      {module.total_lessons} Classes
                    </span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {module.is_free && (
                  <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-semibold">
                    ফ্রি
                  </span>
                )}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* Lessons List */}
            {isExpanded && (
              <div className="mt-2 space-y-1.5 border-l-2 border-gray-100 ml-1.5 pl-4 py-2">
                {module.lessons.map((lesson, lessonIndex) => {
                  const lessonTypeStr = lesson.lesson_type?.toLowerCase() || '';
                  const Icon = LESSON_TYPE_ICONS[lessonTypeStr] || Play;
                  const isActive = lesson.id === activeLessonId;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => !lesson.is_locked && onLessonClick(lesson)}
                      disabled={lesson.is_locked}
                      className={`
                        w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all relative
                        ${
                          isActive
                            ? "bg-primary-50/50 shadow-sm"
                            : "hover:bg-gray-50/80"
                        }
                        ${lesson.is_locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600 rounded-l-xl" />
                      )}

                      {/* Status icon / Play */}
                      <div className="pt-0.5 shrink-0">
                        {lesson.is_locked ? (
                          <Lock className="w-4 h-4 text-gray-400" />
                        ) : lesson.is_completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : isActive ? (
                          <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
                            <Play className="w-2.5 h-2.5 text-white ml-0.5" />
                          </div>
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300" />
                        )}
                      </div>

                      {/* Lesson info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-bn truncate ${
                            isActive
                              ? "text-primary-800 font-bold"
                              : "text-gray-700 font-semibold"
                          }`}
                        >
                          <span className="text-gray-400 font-mono text-xs mr-2">{moduleIndex + 1}.{lessonIndex + 1}</span>
                          {locale === "bn" && lesson.title_bn
                            ? lesson.title_bn
                            : lesson.title}
                        </p>
                        
                        <div className="flex items-center gap-3 mt-1.5">
                          {lesson.duration_seconds && (
                            <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                              <Play className="w-3 h-3" />
                              {formatDuration(lesson.duration_seconds)}
                            </span>
                          )}
                          {isActive && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-md text-[10px] font-bold tracking-widest uppercase">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
