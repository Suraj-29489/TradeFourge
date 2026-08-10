/**
 * TradeFourge Companion v5.5.3 — Web Connection State Machine
 * Formally manages state transitions for the Web Companion Bridge.
 */

import { ConnectionState } from "./protocol";

export type StateChangeListener = (
  currentState: ConnectionState,
  previousState: ConnectionState,
  details?: Record<string, any>
) => void;

export class WebConnectionStateMachine {
  private static instance: WebConnectionStateMachine;
  private currentState: ConnectionState = "Disconnected";
  private previousState: ConnectionState = "Disconnected";
  private listeners: Set<StateChangeListener> = new Set();
  private details: Record<string, any> = {};

  public static getInstance(): WebConnectionStateMachine {
    if (!WebConnectionStateMachine.instance) {
      WebConnectionStateMachine.instance = new WebConnectionStateMachine();
    }
    return WebConnectionStateMachine.instance;
  }

  private constructor() {}

  public getState(): ConnectionState {
    return this.currentState;
  }

  public getPreviousState(): ConnectionState {
    return this.previousState;
  }

  public getDetails(): Record<string, any> {
    return { ...this.details };
  }

  public transitionTo(newState: ConnectionState, details: Record<string, any> = {}): void {
    if (this.currentState === newState && JSON.stringify(this.details) === JSON.stringify(details)) {
      return;
    }

    this.previousState = this.currentState;
    this.currentState = newState;
    this.details = { ...details, timestamp: Date.now() };

    console.log(
      `[WebState] State Transition: ${this.previousState} ➔ ${this.currentState}`,
      details
    );

    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState, this.previousState, this.details);
      } catch (err) {
        console.error("[WebState] Listener error:", err);
      }
    });
  }

  public onChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    // Notify immediate state
    try {
      listener(this.currentState, this.previousState, this.details);
    } catch (err) {
      console.error("[WebState] Initial notification error:", err);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }
}
