import { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '../services/api';

/**
 * Hook for connecting to the live score SignalR hub
 * Provides real-time updates for game scores and bracket progression
 */
export function useScoreHub() {
  const [connection, setConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [lastGameUpdate, setLastGameUpdate] = useState(null);
  const [lastMatchCompleted, setLastMatchCompleted] = useState(null);
  const [lastBracketProgression, setLastBracketProgression] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const connectionRef = useRef(null);
  const joinedEventsRef = useRef(new Set());
  const joinedDivisionsRef = useRef(new Set());
  const maxReconnectAttempts = 5;

  // Build SignalR hub URL for scores
  const getHubUrl = useCallback(() => {
    const baseUrl = API_BASE_URL || window.location.origin;
    return `${baseUrl}/hubs/scores`;
  }, []);

  // Create connection
  const createConnection = useCallback(() => {
    const hubUrl = getHubUrl();
    console.log('ScoreHub: Creating connection to', hubUrl);

    const connectionBuilder = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('jwtToken') || ''
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount >= maxReconnectAttempts) {
            return null;
          }
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    return connectionBuilder;
  }, [getHubUrl]);

  // Connect to SignalR hub
  const connect = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      console.log('ScoreHub: Already connected');
      return connectionRef.current;
    }

    const newConnection = createConnection();
    if (!newConnection) {
      return null;
    }

    // Set up connection state change handlers
    newConnection.onreconnecting((error) => {
      console.log('ScoreHub: Reconnecting...', error);
      setConnectionState('reconnecting');
    });

    newConnection.onreconnected(async (connectionId) => {
      console.log('ScoreHub: Reconnected with ID:', connectionId);
      setConnectionState('connected');

      // Rejoin previously joined groups
      for (const eventId of joinedEventsRef.current) {
        try {
          await newConnection.invoke('JoinEvent', eventId);
          console.log('ScoreHub: Rejoined event', eventId);
        } catch (err) {
          console.error('ScoreHub: Error rejoining event:', err);
        }
      }
      for (const divisionId of joinedDivisionsRef.current) {
        try {
          await newConnection.invoke('JoinDivision', divisionId);
          console.log('ScoreHub: Rejoined division', divisionId);
        } catch (err) {
          console.error('ScoreHub: Error rejoining division:', err);
        }
      }
    });

    newConnection.onclose((error) => {
      console.log('ScoreHub: Connection closed', error);
      setConnectionState('disconnected');
      connectionRef.current = null;
      setConnection(null);
    });

    // Set up score event handlers
    newConnection.on('GameScoreUpdated', (update) => {
      console.log('ScoreHub: Game score updated', update);
      setLastGameUpdate({ ...update, receivedAt: Date.now() });
      setRefreshSignal(prev => prev + 1);
    });

    newConnection.on('MatchCompleted', (update) => {
      console.log('ScoreHub: Match completed', update);
      setLastMatchCompleted({ ...update, receivedAt: Date.now() });
      setRefreshSignal(prev => prev + 1);
    });

    newConnection.on('BracketProgression', (update) => {
      console.log('ScoreHub: Bracket progression', update);
      setLastBracketProgression({ ...update, receivedAt: Date.now() });
      setRefreshSignal(prev => prev + 1);
    });

    newConnection.on('ScheduleRefresh', (data) => {
      console.log('ScoreHub: Schedule refresh signal', data);
      setRefreshSignal(prev => prev + 1);
    });

    try {
      setConnectionState('connecting');
      await newConnection.start();
      console.log('ScoreHub: Connected successfully');
      setConnectionState('connected');
      connectionRef.current = newConnection;
      setConnection(newConnection);
      return newConnection;
    } catch (err) {
      console.error('ScoreHub: Connection failed:', err);
      setConnectionState('disconnected');
      return null;
    }
  }, [createConnection]);

  // Disconnect from SignalR hub
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
        console.log('ScoreHub: Disconnected');
      } catch (err) {
        console.error('ScoreHub: Error disconnecting:', err);
      }
      connectionRef.current = null;
      setConnection(null);
      setConnectionState('disconnected');
      joinedEventsRef.current.clear();
      joinedDivisionsRef.current.clear();
    }
  }, []);

  // Join an event for score updates
  const joinEvent = useCallback(async (eventId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('JoinEvent', eventId);
        joinedEventsRef.current.add(eventId);
        console.log('ScoreHub: Joined event', eventId);
        return true;
      } catch (err) {
        console.error('ScoreHub: Error joining event:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Leave an event
  const leaveEvent = useCallback(async (eventId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('LeaveEvent', eventId);
        joinedEventsRef.current.delete(eventId);
        console.log('ScoreHub: Left event', eventId);
        return true;
      } catch (err) {
        console.error('ScoreHub: Error leaving event:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Join a division for score updates
  const joinDivision = useCallback(async (divisionId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('JoinDivision', divisionId);
        joinedDivisionsRef.current.add(divisionId);
        console.log('ScoreHub: Joined division', divisionId);
        return true;
      } catch (err) {
        console.error('ScoreHub: Error joining division:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Leave a division
  const leaveDivision = useCallback(async (divisionId) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('LeaveDivision', divisionId);
        joinedDivisionsRef.current.delete(divisionId);
        console.log('ScoreHub: Left division', divisionId);
        return true;
      } catch (err) {
        console.error('ScoreHub: Error leaving division:', err);
        return false;
      }
    }
    return false;
  }, []);

  // Clear event data
  const clearLastGameUpdate = useCallback(() => {
    setLastGameUpdate(null);
  }, []);

  const clearLastMatchCompleted = useCallback(() => {
    setLastMatchCompleted(null);
  }, []);

  const clearLastBracketProgression = useCallback(() => {
    setLastBracketProgression(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, []);

  return {
    connection,
    connectionState,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    joinEvent,
    leaveEvent,
    joinDivision,
    leaveDivision,
    // Event data
    lastGameUpdate,
    lastMatchCompleted,
    lastBracketProgression,
    refreshSignal,
    // Clear functions
    clearLastGameUpdate,
    clearLastMatchCompleted,
    clearLastBracketProgression
  };
}

// Score event names for type safety
export const ScoreEvents = {
  GameScoreUpdated: 'GameScoreUpdated',
  MatchCompleted: 'MatchCompleted',
  BracketProgression: 'BracketProgression',
  ScheduleRefresh: 'ScheduleRefresh'
};
