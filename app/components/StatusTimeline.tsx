'use client';

import React from 'react';

interface StatusTimelineProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  isEditing: boolean;
}

const workflowStages = [
  { key: 'application_form_sent', label: 'Form Sent' },
  { key: 'application_form_received', label: 'Form Received' },
  { key: 'draft_verified', label: 'Draft Verified' },
  { key: 'draft_approved', label: 'Draft Approved' },
  { key: 'certification_sent', label: 'Cert Sent' },
  { key: 'completed_won', label: 'Won' },
  { key: 'completed_lost', label: 'Lost' }
];

export default function StatusTimeline({ currentStatus, onStatusChange, isEditing }: StatusTimelineProps) {
  const currentIndex = workflowStages.findIndex(stage => stage.key === currentStatus);
  
  const isStageCompleted = (index: number) => {
    // Handle the branching logic for won/lost
    if (currentStatus === 'completed_won') {
      return index <= 4 || index === 5; // Up to cert_sent + won
    }
    if (currentStatus === 'completed_lost') {
      return index <= 4 || index === 6; // Up to cert_sent + lost
    }
    return index <= currentIndex;
  };

  const isCurrentStage = (index: number) => {
    return index === currentIndex;
  };

  const handleStageClick = (stageKey: string) => {
    if (isEditing) {
      onStatusChange(stageKey);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Workflow Progress</h3>
        {isEditing && (
          <span className="text-sm text-blue-600 font-medium">Click any stage to update</span>
        )}
      </div>
      
      {/* Single Line Workflow */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {/* Main workflow stages (first 5) */}
          {workflowStages.slice(0, 5).map((stage, index) => (
            <div key={stage.key} className="flex flex-col items-center relative flex-1">
              {/* Circle */}
              <div
                className={`
                  w-4 h-4 rounded-full border-2 transition-all duration-300 cursor-pointer relative z-10
                  ${isStageCompleted(index) 
                    ? 'bg-green-500 border-green-500' 
                    : 'bg-white border-gray-300'
                  }
                  ${isCurrentStage(index) ? 'ring-4 ring-green-200' : ''}
                  ${isEditing ? 'hover:scale-125' : ''}
                `}
                onClick={() => handleStageClick(stage.key)}
              />
              
              {/* Label */}
              <span className={`
                mt-2 text-xs font-medium text-center
                ${isStageCompleted(index) ? 'text-green-600' : 'text-gray-500'}
                ${isCurrentStage(index) ? 'font-semibold' : ''}
              `}>
                {stage.label}
              </span>
              
              {/* Connecting line to next stage */}
              {index < 4 && (
                <div 
                  className={`
                    absolute top-2 left-1/2 h-0.5 transform -translate-y-1/2 z-0
                    ${isStageCompleted(index) && isStageCompleted(index + 1) 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                    }
                  `}
                  style={{ 
                    width: 'calc(100% - 1rem)',
                    marginLeft: '0.5rem'
                  }}
                />
              )}
            </div>
          ))}
          
          {/* Won/Lost branches */}
          <div className="flex flex-col items-center relative ml-8">
            {/* Vertical connector from cert_sent */}
            <div className={`
              absolute w-0.5 h-6 transform -translate-x-1/2 -top-6 left-1/2
              ${currentIndex >= 4 ? 'bg-green-500' : 'bg-gray-300'}
            `} />
            
            {/* Won/Lost options */}
            <div className="flex space-x-8 mt-2">
              {workflowStages.slice(5).map((stage, index) => {
                const actualIndex = 5 + index;
                return (
                  <div key={stage.key} className="flex flex-col items-center relative">
                    {/* Diagonal line to Won/Lost */}
                    <div className={`
                      absolute w-6 h-0.5 transform -translate-y-1/2 -top-2
                      ${index === 0 ? 'rotate-45 -left-3' : '-rotate-45 -right-3'}
                      ${isStageCompleted(actualIndex) ? 'bg-green-500' : 'bg-gray-300'}
                    `} />
                    
                    {/* Circle */}
                    <div
                      className={`
                        w-4 h-4 rounded-full border-2 transition-all duration-300 cursor-pointer relative z-10
                        ${isStageCompleted(actualIndex)
                          ? stage.key === 'completed_won' 
                            ? 'bg-green-500 border-green-500' 
                            : 'bg-red-500 border-red-500'
                          : 'bg-white border-gray-300'
                        }
                        ${isCurrentStage(actualIndex) ? 'ring-4 ring-opacity-50' : ''}
                        ${isCurrentStage(actualIndex) && stage.key === 'completed_won' ? 'ring-green-200' : ''}
                        ${isCurrentStage(actualIndex) && stage.key === 'completed_lost' ? 'ring-red-200' : ''}
                        ${isEditing ? 'hover:scale-125' : ''}
                      `}
                      onClick={() => handleStageClick(stage.key)}
                    />
                    
                    {/* Label */}
                    <span className={`
                      mt-2 text-xs font-medium text-center
                      ${isStageCompleted(actualIndex)
                        ? stage.key === 'completed_won' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                        : 'text-gray-500'
                      }
                      ${isCurrentStage(actualIndex) ? 'font-semibold' : ''}
                    `}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Current status summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Current Status: <span className="font-semibold text-gray-900">
              {workflowStages.find(stage => stage.key === currentStatus)?.label}
            </span>
          </span>
          <span className="text-gray-500">
            Stage {currentIndex + 1} of {workflowStages.length}
          </span>
        </div>
      </div>
    </div>
  );
}