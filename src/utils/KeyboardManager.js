// src/utils/KeyboardManager.js
import { EventHandlerHelper } from './AppUtilities.js';

export class KeyboardManager {
  constructor(saveLoadManager, backupDialog, updateShaderFromGraph, createNewProject) {
    this.saveLoadManager = saveLoadManager;
    this.backupDialog = backupDialog;
    this.updateShaderFromGraph = updateShaderFromGraph;
    this.createNewProject = createNewProject;
    this.isSetup = false;
  }

  setup() {
    if (this.isSetup) return;
    
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.isSetup = true;
    console.log('Keyboard shortcuts initialized');
  }

  handleKeyDown(e) {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    if (!cmdKey) return;

    switch (e.key.toLowerCase()) {
      case 's':
        this.handleSaveShortcut(e);
        break;
      case 'o':
        this.handleOpenShortcut(e);
        break;
      case 'l':
        this.handleLoadShortcut(e);
        break;
      case 'e':
        this.handleExportShortcut(e);
        break;
      case 'n':
        this.handleNewProjectShortcut(e);
        break;
      case 'b':
        this.handleBackupShortcut(e);
        break;
      case 'r':
        this.handleRebuildShortcut(e);
        break;
    }
  }

  handleSaveShortcut(e) {
    e.preventDefault();
    if (e.shiftKey) {
      // Ctrl+Shift+S: Save to local storage
      this.saveLoadManager.saveToLocal();
    } else {
      // Ctrl+S: Save to file
      this.saveLoadManager.saveToFile();
    }
  }

  handleOpenShortcut(e) {
    e.preventDefault();
    // Ctrl+O: Open file
    EventHandlerHelper.triggerFileLoad();
  }

  handleLoadShortcut(e) {
    e.preventDefault();
    // Ctrl+L: Load from local storage
    this.saveLoadManager.loadFromLocal();
  }

  handleExportShortcut(e) {
    e.preventDefault();
    if (e.shiftKey) {
      // Ctrl+Shift+E: Export WGSL
      this.saveLoadManager.saveToFile(null, 'wgsl');
    } else {
      // Ctrl+E: Export JSON
      this.saveLoadManager.saveToFile(null, 'json');
    }
  }

  handleNewProjectShortcut(e) {
    e.preventDefault();
    // Ctrl+N: New project
    if (confirm('Create new project? Unsaved changes will be lost.')) {
      this.createNewProject();
    }
  }

  handleBackupShortcut(e) {
    e.preventDefault();
    // Ctrl+B: Show backup dialog
    if (this.backupDialog) {
      this.backupDialog.show();
    }
  }

  handleRebuildShortcut(e) {
    // Don't preventDefault for Ctrl+R - let browser refresh
    if (!e.shiftKey) {
      // Ctrl+R: Let browser handle page refresh
      return;
    } else {
      // Ctrl+Shift+R: Rebuild shader
      e.preventDefault();
      this.updateShaderFromGraph();
    }
  }

  destroy() {
    // Remove event listener if needed
    this.isSetup = false;
  }
}