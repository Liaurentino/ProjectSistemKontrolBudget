import React, { createContext, useContext, useState } from "react";

interface Entity {
  id: string;
  entity_name?: string; // sesuai dengan struktur dari Supabase
  name?: string;
  nama?: string;
  // tambahkan field lain sesuai struktur data Anda
}

interface EntityContextType {
  entities: Entity[];
  setEntities: (entities: Entity[]) => void;
  activeEntityIds: string[];
  toggleEntity: (id: string) => void;
  isEntityActive: (id: string) => boolean;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export const EntityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
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
    <EntityContext.Provider 
      value={{ 
        entities, 
        setEntities, 
        activeEntityIds, 
        toggleEntity, 
        isEntityActive 
      }}
    >
      {children}
    </EntityContext.Provider>
  );
};

export const useEntity = () => {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error("useEntity harus di dalam EntityProvider");
  return ctx;
};