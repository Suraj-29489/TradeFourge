// lib/teams/teams-service.ts
// TradeFourge v5.0 Multi-User Team Workspace & Invitation Engine

export type TeamRole = "Owner" | "Admin" | "Member" | "Viewer";
export type InvitationStatus = "Pending" | "Accepted" | "Expired";

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  joinedAt: string;
  avatarUrl?: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  status: InvitationStatus;
  sentAt: string;
  expiresAt: string;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  ownerUserId: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
  createdAt: string;
}

function getTeamStorageKey(userId: string): string {
  return `tf_team_workspace_${userId || "default_user"}`;
}

export function fetchTeamWorkspace(userId: string): TeamWorkspace {
  if (typeof window === "undefined") {
    return createDefaultWorkspace(userId);
  }

  try {
    const raw = localStorage.getItem(getTeamStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaultWs = createDefaultWorkspace(userId);
  try {
    localStorage.setItem(getTeamStorageKey(userId), JSON.stringify(defaultWs));
  } catch {}

  return defaultWs;
}

function createDefaultWorkspace(userId: string): TeamWorkspace {
  return {
    id: `WS-${Date.now()}`,
    name: "Primary Trading Desk",
    ownerUserId: userId,
    members: [
      {
        id: `MEM-1`,
        email: "trader@tradefourge.com",
        name: "Desk Lead (Owner)",
        role: "Owner",
        joinedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      },
    ],
    invitations: [],
    createdAt: new Date().toISOString(),
  };
}

export function inviteTeamMember(
  userId: string,
  email: string,
  role: TeamRole
): TeamInvitation {
  const ws = fetchTeamWorkspace(userId);
  const now = new Date();

  const invitation: TeamInvitation = {
    id: `INV-${Date.now()}`,
    email,
    role,
    invitedBy: userId,
    status: "Pending",
    sentAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
  };

  ws.invitations.unshift(invitation);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getTeamStorageKey(userId), JSON.stringify(ws));
    } catch (err) {
      console.error("[TeamsService] Failed to save invitation:", err);
    }
  }

  return invitation;
}

export function revokeInvitation(userId: string, invitationId: string): void {
  const ws = fetchTeamWorkspace(userId);
  ws.invitations = ws.invitations.filter((i) => i.id !== invitationId);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getTeamStorageKey(userId), JSON.stringify(ws));
    } catch (err) {
      console.error("[TeamsService] Failed to revoke invitation:", err);
    }
  }
}
