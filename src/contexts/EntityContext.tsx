import React, { createContext, useContext, useState, useEffect } from "react";

interface Entity {
  id: string;
  entity_name?: string;
  name?: string;
  nama?: string;
  api_token?: string;
}

interface EntityContextType {
  entities: Entity[];
  setEntities: (entities: Entity[]) => void;
  activeEntityId: string | null;
  activeEntity: Entity | null;
  setActiveEntity: (id: string | null) => void;
  isEntityActive: (id: string) => boolean;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export const EntityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);

  // Load active entity dari localStorage saat mount
  useEffect(() => {
    const savedEntityId = localStorage.getItem('active_entity_id');
    if (savedEntityId) {
      setActiveEntityId(savedEntityId);
    }
  }, []);

  // Save ke localStorage setiap kali activeEntityId berubah
  useEffect(() => {
    if (activeEntityId) {
      localStorage.setItem('active_entity_id', activeEntityId);
    } else {
      localStorage.removeItem('active_entity_id');
    }
  }, [activeEntityId]);

  // Get active entity object
  const activeEntity = entities.find((e) => e.id === activeEntityId) || null;

  const setActiveEntity = (id: string | null) => {
    setActiveEntityId(id);
  };

  const isEntityActive = (id: string) => {
    return activeEntityId === id;
  };

  return (
    <EntityContext.Provider 
      value={{ 
        entities, 
        setEntities, 
        activeEntityId,
        activeEntity,
        setActiveEntity, 
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