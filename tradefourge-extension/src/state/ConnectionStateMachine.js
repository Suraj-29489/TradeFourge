/**
 * TradeFourge Companion Extension v5.5.3 — Connection State Machine
 * Formally tracks runtime lifecycle states and manages state transitions.
 *
 * Valid States:
 *   Disconnected → Connecting → Injected → Connected → Authenticated → Streaming
 *   Error / Recovering → Connected
 */

export const ConnectionStates = {
  DISCONNECTED: 'Disconnected',
  CONNECTING: 'Connecting',
  INJECTED: 'Injected',
  CONNECTED: 'Connected',
  AUTHENTICATED: 'Authenticated',
  STREAMING: 'Streaming',
  ERROR: 'Error',
  RECOVERING: 'Recovering',
};

export class ConnectionStateMachine {
  static instance = null;

  static getInstance() {
    if (!ConnectionStateMachine.instance) {
      ConnectionStateMachine.instance = new ConnectionStateMachine();
    }
    return ConnectionStateMachine.instance;
  }

  constructor() {
    this.currentState = ConnectionStates.DISCONNECTED;
    this.previousState = ConnectionStates.DISCONNECTED;
    this.listeners = new Set();
    this.stateDetails = {};
    this.lastTransitionTime = Date.now();
  }

  getState() {
    return this.currentState;
  }

  getPreviousState() {
    return this.previousState;
  }

  getDetails() {
    return { ...this.stateDetails };
  }

  transitionTo(newState, details = {}) {
    if (this.currentState === newState && JSON.stringify(this.stateDetails) === JSON.stringify(details)) {
      return;
    }

    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateDetails = { ...details, timestamp: Date.now() };
    this.lastTransitionTime = Date.now();

    const transitionPayload = {
      from: this.previousState,
      to: this.currentState,
      details: this.stateDetails,
      timestamp: this.lastTransitionTime,
    };

    console.log(
      `[ConnectionState] State Transition: ${this.previousState} ➔ ${this.currentState}`,
      details
    );

    this.listeners.forEach((listener) => {
      try {
        listener(transitionPayload);
      } catch (err) {
        console.error('[ConnectionState] Listener error during transition:', err);
      }
    });
  }

  onChange(callback) {
    this.listeners.add(callback);
    // Immediately emit current state
    try {
      callback({
        from: this.previousState,
        to: this.currentState,
        details: this.stateDetails,
        timestamp: this.lastTransitionTime,
      });
    } catch (err) {
      console.error('[ConnectionState] Initial listener notification error:', err);
    }

    return () => {
      this.listeners.delete(callback);
    };
  }

  reset() {
    this.transitionTo(ConnectionStates.DISCONNECTED, { reason: 'Reset initiated' });
  }
}
