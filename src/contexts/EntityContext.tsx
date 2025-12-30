import React, { createContext, useContext, useState } from "react";

interface EntityContextType {
  activeEntityIds: string[];
  toggleEntity: (id: string) => void;
  isEntityActive: (id: string) => boolean;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export const EntityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeEntityIds, setActiveEntityIds] = useState<string[]>([]);

  const toggleEntity = (id: string) => {
    setActiveEntityIds((prev) =>
      prev.includes(id)
        ? prev.filter((eid) => eid !== id)
        : [...prev, id]
    );
  };

  const isEntityActive = (id: string) => {
    return activeEntityIds.includes(id);
  };

  return (
    <EntityContext.Provider value={{ activeEntityIds, toggleEntity, isEntityActive }}>
      {children}
    </EntityContext.Provider>
  );
};

export const useEntity = () => {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error("useEntity harus di dalam EntityProvider");
  return ctx;
};
