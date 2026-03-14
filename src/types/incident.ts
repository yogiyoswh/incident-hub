export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type TimelineTag = 'ACTION' | 'DECISION' | 'HYPOTHESIS' | 'VERIFY' | 'RESULT';
export type TimelineSource = 'slack' | 'zoom' | 'manual';

export type Briefing = {
  detection: string;
  customerImpact: string;
  opsImpact: string;
  generatedAt: string;
  sourceChannel: string;
};

export type TimelineItem = {
  id: string;
  time: string;
  tag: TimelineTag;
  actor: string;
  content: string;
  source: TimelineSource;
};

export type Responder = {
  name: string;
  role: 'LEAD' | 'OWNER' | 'OPS' | 'CS' | 'DEV';
  avatarColor: string;
};

export type ImpactSummary = {
  affectedCount?: number;
  durationMinutes?: number;
  currentSuccessRate?: number;
};

export type Incident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  slackChannel: string;
  jiraTicketId?: string;
  createdAt: string;
  updatedAt: string;
  briefing: Briefing;
  timeline: TimelineItem[];
  responders: Responder[];
  impact?: ImpactSummary;
};

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type SlackMessage = {
  ts: string;
  user: string;
  text: string;
};

export type BriefingPromptResult = {
  detection: string;
  customerImpact: string;
  opsImpact: string;
};

export type TimelinePromptResult = {
  items: Array<{
    time: string;
    tag: TimelineTag;
    actor: string;
    content: string;
  }>;
};

export type ParsedSlackThread = {
  channelId: string;
  threadTs: string;
};

export type SlackThreadBriefingRequest = {
  slackThreadUrl: string;
};

export type SlackThreadBriefingResponse = {
  briefing: BriefingPromptResult;
  messageCount: number;
  channelId: string;
  threadTs: string;
};
