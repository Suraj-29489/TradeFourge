/**
 * TradeFourge Extension v1.0 — Type Definitions
 */

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';

export type MessageDirection = 'INCOMING' | 'OUTGOING';

export interface InterceptedWebSocketEvent {
  direction: MessageDirection;
  socketUrl: string;
  payload: string | ArrayBuffer | Blob;
  payloadSize: number;
  timestamp: string;
}

export interface ExtensionState {
  messagesCaptured: number;
  lastUpdated: string;
  installedAt?: string;
}

export interface InjectedMessageBridgeEvent {
  source: 'tradefourge-injected';
  type: 'WS_MESSAGE_CAPTURED';
  detail: {
    direction: MessageDirection;
    url: string;
    size: number;
    timestamp: string;
  };
}

export interface BrokerDescriptor {
  id: string;
  name: string;
  matchPattern: RegExp;
  supportsWebSocket: boolean;
  supportsHTTP: boolean;
}
