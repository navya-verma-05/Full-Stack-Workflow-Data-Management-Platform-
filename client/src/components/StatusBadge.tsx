import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Clock,
  Shield,
  User,
  Eye,
} from "lucide-react";
import type { EventStatus, UserRole } from "../types/api";

const EVENT_STATUS_CONFIG: Record<
  EventStatus,
  {
    classes: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dotColor: string;
  }
> = {
  processed: {
    classes:
      "bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7] dark:bg-[#132E1B] dark:text-[#4ADE80] dark:border-[#1E4627]",
    label: "processed",
    icon: CheckCircle2,
    dotColor: "bg-[#2E7D32] dark:bg-[#4ADE80]",
  },
  invalid: {
    classes:
      "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A] dark:bg-[#33220A] dark:text-[#FBBF24] dark:border-[#4D3310]",
    label: "invalid",
    icon: AlertTriangle,
    dotColor: "bg-[#B45309] dark:bg-[#FBBF24]",
  },
  failed: {
    classes:
      "bg-[#FFEDD5] text-[#C2410C] border-[#FDBA74] dark:bg-[#361808] dark:text-[#FB923C] dark:border-[#52230B]",
    label: "failed",
    icon: RotateCcw,
    dotColor: "bg-[#C2410C] dark:bg-[#FB923C]",
  },
  dead_letter: {
    classes:
      "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA] dark:bg-[#381111] dark:text-[#F87171] dark:border-[#541919]",
    label: "dead-letter",
    icon: XCircle,
    dotColor: "bg-[#B91C1C] dark:bg-[#F87171]",
  },
  valid: {
    classes:
      "bg-[#ECE9E2] text-[#1B1B1A] border-[#E4E1DA] dark:bg-[#262522] dark:text-[#ECE9E2] dark:border-[#2B2A27]",
    label: "queued",
    icon: Clock,
    dotColor: "bg-[#6B6B66] dark:bg-[#8E8B82]",
  },
  received: {
    classes:
      "bg-[#ECE9E2] text-[#1B1B1A] border-[#E4E1DA] dark:bg-[#262522] dark:text-[#ECE9E2] dark:border-[#2B2A27]",
    label: "received",
    icon: Clock,
    dotColor: "bg-[#6B6B66] dark:bg-[#8E8B82]",
  },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const conf = EVENT_STATUS_CONFIG[status] || EVENT_STATUS_CONFIG.received;
  const Icon = conf.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${conf.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{conf.label}</span>
    </span>
  );
}

export function StatusDot({ status }: { status: EventStatus }) {
  const conf = EVENT_STATUS_CONFIG[status] || EVENT_STATUS_CONFIG.received;
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${conf.dotColor}`}
      aria-hidden="true"
    />
  );
}

const ROLE_CONFIG: Record<
  UserRole,
  {
    classes: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  admin: {
    classes:
      "bg-[#1B1B1A] text-[#F6F4EF] border-[#1B1B1A] dark:bg-[#ECE9E2] dark:text-[#141413] dark:border-[#ECE9E2]",
    icon: Shield,
  },
  manager: {
    classes:
      "bg-[#ECE9E2] text-[#1B1B1A] border-[#E4E1DA] dark:bg-[#262522] dark:text-[#ECE9E2] dark:border-[#2B2A27]",
    icon: User,
  },
  viewer: {
    classes:
      "bg-transparent text-[#6B6B66] border-[#E4E1DA] dark:text-[#8E8B82] dark:border-[#2B2A27]",
    icon: Eye,
  },
};

export function RoleBadge({ role }: { role: UserRole }) {
  const conf = ROLE_CONFIG[role] || ROLE_CONFIG.viewer;
  const Icon = conf.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium capitalize ${conf.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{role}</span>
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${
        active
          ? "border-[#A5D6A7] bg-[#E8F5E9] text-[#2E7D32] dark:border-[#1E4627] dark:bg-[#132E1B] dark:text-[#4ADE80]"
          : "border-[#E4E1DA] bg-[#ECE9E2] text-[#6B6B66] dark:border-[#2B2A27] dark:bg-[#262522] dark:text-[#8E8B82]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#2E7D32] dark:bg-[#4ADE80]" : "bg-[#6B6B66] dark:bg-[#8E8B82]"}`}
      />
      <span>{active ? "Active" : "Disabled"}</span>
    </span>
  );
}
