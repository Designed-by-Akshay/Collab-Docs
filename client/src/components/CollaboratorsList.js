import React from 'react';
import { X } from 'lucide-react';

export default function CollaboratorsList({ isOpen, onClose, collaborators }) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-12 w-64 bg-white rounded-lg shadow-lg border p-4 z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-700">Current Collaborators</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="space-y-3">
        {Array.from(collaborators.values()).map((collaborator, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div 
              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm"
              style={{ backgroundColor: collaborator.color }}
            >
              {collaborator.displayName[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {collaborator.displayName}
              </p>
              <p className="text-xs text-gray-500">
                {collaborator.isAnonymous ? 'Guest' : 'Signed in user'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}