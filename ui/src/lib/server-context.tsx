"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Config, Target, RBACConfig, Listener, TargetWithType } from "@/lib/types";
import { fetchListeners, fetchMcpTargets, fetchA2aTargets } from "@/lib/api";

interface ServerContextType {
  config: Config;
  setConfig: (config: Config) => void;
  isConnected: boolean;
  connectionError: string | null;
  listeners: Listener[];
  targets: Target[];
  policies: RBACConfig[];
  refreshListeners: () => Promise<void>;
  refreshTargets: () => Promise<void>;
  isConfigurationEmpty: () => Promise<boolean>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config>({
    type: "static",
    listeners: [],
    targets: [],
    policies: [],
  });

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [targets, setTargets] = useState<TargetWithType[]>([]);
  const [policies, setPolicies] = useState<RBACConfig[]>([]);

  // Function to refresh listeners
  const refreshListeners = async () => {
    try {
      // Fetch listeners configuration
      const listenersData = await fetchListeners();
      const listenersArray = Array.isArray(listenersData) ? listenersData : [listenersData];
      setListeners(listenersArray);

      // Extract policies from listeners
      const allPolicies = listenersArray.flatMap((listener) => listener.sse?.rbac || []);
      setPolicies(allPolicies);
    } catch (err) {
      console.error("Error refreshing listeners:", err);
      setConnectionError(err instanceof Error ? err.message : "Failed to refresh listeners");
    }
  };

  // Function to refresh targets
  const refreshTargets = async () => {
    try {
      // Fetch MCP and A2A targets
      const mcpTargetsData = await fetchMcpTargets();
      const a2aTargetsData = await fetchA2aTargets();

      // Combine targets
      const targetsArray = [
        ...mcpTargetsData.map((target) => ({ ...target, type: "mcp" as const })),
        ...a2aTargetsData.map((target) => ({ ...target, type: "a2a" as const })),
      ];
      setTargets(targetsArray);

      // Update the config with the new targets
      setConfig((prevConfig) => ({
        ...prevConfig,
        targets: targetsArray,
      }));
    } catch (err) {
      console.error("Error refreshing targets:", err);
      setConnectionError(err instanceof Error ? err.message : "Failed to refresh targets");
    }
  };

  // Load configuration from server on mount
  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        // Fetch listeners configuration
        const listenersData = await fetchListeners();
        const listenersArray = Array.isArray(listenersData) ? listenersData : [listenersData];
        setListeners(listenersArray);

        // Fetch MCP and A2A targets
        const mcpTargetsData = await fetchMcpTargets();
        const a2aTargetsData = await fetchA2aTargets();

        // Combine targets
        const targetsArray = [
          ...mcpTargetsData.map((target) => ({ ...target, type: "mcp" as const })),
          ...a2aTargetsData.map((target) => ({ ...target, type: "a2a" as const })),
        ];
        setTargets(targetsArray);

        // Extract policies from listeners
        const allPolicies = listenersArray.flatMap((listener) => listener.sse?.rbac || []);
        setPolicies(allPolicies);

        // Update the config state with the loaded data
        setConfig({
          type: "static",
          listeners: listenersArray,
          targets: targetsArray,
          policies: allPolicies,
        });

        setIsConnected(true);
        setConnectionError(null);
      } catch (err) {
        console.error("Error loading configuration:", err);
        setConnectionError(err instanceof Error ? err.message : "Failed to load configuration");
        setIsConnected(false);
      }
    };

    loadConfiguration();
  }, []);

  const isConfigurationEmpty = async () => {
    const listeners = await fetchListeners();
    const mcpTargets = await fetchMcpTargets();
    const a2aTargets = await fetchA2aTargets();
    return listeners.length === 0 && mcpTargets.length === 0 && a2aTargets.length === 0;
  };

  return (
    <ServerContext.Provider
      value={{
        config,
        setConfig,
        isConnected,
        connectionError,
        listeners,
        targets,
        policies,
        refreshListeners,
        refreshTargets,
        isConfigurationEmpty,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const context = useContext(ServerContext);
  if (context === undefined) {
    throw new Error("useServer must be used within a ServerProvider");
  }
  return context;
}
