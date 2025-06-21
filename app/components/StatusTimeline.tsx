'use client';

import React from 'react';

interface StatusTimelineProps {
  currentStatus: string;
  statuses: string[];
  onStatusChange: (newStatus: string) => Promise<void>;
  showClosedOptions: boolean;
  onClosedStatusSelect: (type: 'won' | 'lost') => Promise<void>;
  setShowClosedOptions: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function StatusTimeline({
  currentStatus,
  statuses,
  onStatusChange,
  showClosedOptions,
  onClosedStatusSelect,
  setShowClosedOptions,
}: StatusTimelineProps) {
  const stageMap: Record<string, { label: string; shortLabel: string }> = {
    'application_form_sent': { label: 'Application Form Sent', shortLabel: 'Form Sent' },
    'application_form_received': { label: 'Application Form Received', shortLabel: 'Form Received' },
    'draft_reviewed': { label: 'Draft Reviewed', shortLabel: 'Draft Verified' },
    'draft_approved': { label: 'Draft Approved', shortLabel: 'Draft Approved' },
    'certificate_sent': { label: 'Certificate Sent', shortLabel: 'Cert. Sent' },
    'closed_won': { label: 'Closed Won', shortLabel: 'Closed' },
    'closed_lost': { label: 'Closed Lost', shortLabel: 'Closed (Lost)' },
  };

  const visualStages = [
    'application_form_sent',
    'application_form_received',
    'draft_reviewed',
    'draft_approved',
    'certificate_sent',
    'closed_won',
  ];

  const actualCurrentIndex = visualStages.findIndex(stageId => stageId === currentStatus);
  const effectiveCurrentIndex = (currentStatus === 'closed_lost') ? visualStages.indexOf('closed_won') : actualCurrentIndex;

  const isStageCompleted = (stageId: string, index: number) => {
    if (currentStatus === 'closed_won' || currentStatus === 'closed_lost') {
      return index <= visualStages.indexOf('closed_won');
    }
    return index <= actualCurrentIndex;
  };

  const isCurrentStage = (stageId: string) => stageId === currentStatus;

  const handleStageClick = (stageId: string) => {
    if (stageId === 'certificate_sent' && currentStatus === 'certificate_sent') {
      setShowClosedOptions(true);
    } else if (stageId === 'closed_won') {
      setShowClosedOptions(true);
    } else if (stageId !== currentStatus) {
      onStatusChange(stageId);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-semibold text-gray-900">
            Workflow Progress
          </h3>
        </div>

        <div className="relative flex items-center justify-between w-full">
          {/* Background line */}
          <div className="absolute left-0 right-0 h-1 bg-gray-300 z-0" style={{ top: 'calc(50% - 2px)' }} />

          {/* Progress line */}
          <div
            className="absolute left-0 h-1 bg-green-500 z-10 transition-all duration-500"
            style={{ width: `${(effectiveCurrentIndex / (visualStages.length - 1)) * 100}%`, top: 'calc(50% - 2px)' }}
          />

          {/* Dots */}
          {visualStages.map((stageId, index) => {
            const stageInfo = stageMap[stageId];
            if (!stageInfo) return null;

            const isCompleted = isStageCompleted(stageId, index);
            const isActive = isCurrentStage(stageId);

            // Calculate dot position dynamically
            const dotLeft = (index / (visualStages.length - 1)) * 100; // Percentage from left

            return (
              <div
                key={stageId}
                className="flex flex-col items-center z-20 relative text-center"
                style={{ left: `${dotLeft}%`, position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <div
                  className={`
                    w-4 h-4 rounded-full border-2 transition-all duration-300 cursor-pointer
                    ${isActive
                      ? 'bg-green-500 border-green-500 ring-4 ring-green-300 ring-opacity-75'
                      : isCompleted
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'}
                    hover:scale-125
                  `}
                  onClick={() => handleStageClick(stageId)}
                  title={stageInfo.label}
                />
                <span
                  className={`
                    mt-2 text-xs font-medium
                    ${isCompleted ? 'text-green-600' : 'text-gray-500'}
                    ${isActive ? 'font-semibold' : ''}
                  `}
                >
                  {stageInfo.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showClosedOptions && (
        <div className="flex justify-center mt-4 space-x-4">
          <button
            onClick={() => onClosedStatusSelect('won')}
            className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800"
          >
            Closed Won
          </button>
          <button
            onClick={() => onClosedStatusSelect('lost')}
            className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800"
          >
            Closed Lost
          </button>
        </div>
      )}
    </div>
  );
}