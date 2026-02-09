import React, { useState } from 'react';
import { Toolbox } from '@ohif/extension-default';
import { useSystem } from '@ohif/core';
import { Icons } from '@ohif/ui-next';
import ChatSection from './ChatSection';

interface PanelSegmentationWithChatProps {
  extensionManager: any;
}

function PanelSegmentationWithChat({ extensionManager }: PanelSegmentationWithChatProps) {
  const { servicesManager } = useSystem();
  const { toolbarService } = servicesManager.services;
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Get the PanelSegmentation component from cornerstone extension
  const panelModule = extensionManager.getModuleEntry(
    '@ohif/extension-cornerstone.panelModule.panelSegmentation'
  );

  const PanelSegmentation = panelModule?.component;

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Scrollable area for segmentation tools */}
      <div className="ohif-scrollbar min-h-0 flex-1 overflow-y-auto">
        {/* Segmentation Tools */}
        <Toolbox
          buttonSectionId={toolbarService.sections.segmentationToolbox}
          title="Segmentation Tools"
        />

        {/* Segmentations Panel */}
        {PanelSegmentation && <PanelSegmentation />}
      </div>

      {/* Chat Section - fixed at bottom, never scrolls away */}
      <div className="shrink-0 border-t border-gray-700 bg-black">
        {/* Chat Header */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-secondary-dark hover:bg-accent text-aqua-pale my-0.5 flex h-7 w-full items-center justify-between rounded py-2 pr-1 pl-2.5 text-[13px]"
        >
          <span>Chat</span>
          <Icons.ChevronDown
            className={`h-4 w-4 transition-transform ${isChatOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {/* Chat Content */}
        {isChatOpen && <ChatSection />}
      </div>
    </div>
  );
}

export default PanelSegmentationWithChat;
