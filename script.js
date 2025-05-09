document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const noteTitleInput = document.getElementById('note-title-input');
    const cuesInput = document.getElementById('cues-input');
    const mainNotesInput = document.getElementById('main-notes-input');
    const summaryInput = document.getElementById('summary-input');

    const newNoteButton = document.getElementById('new-note-button');
    const saveNoteButton = document.getElementById('save-note-button');
    const deleteNoteButton = document.getElementById('delete-note-button');
    const exportMdButton = document.getElementById('export-md-button');
    const themeToggleButton = document.getElementById('theme-toggle-button');

    const notesListUl = document.getElementById('notes-list');
    const feedbackMessageEl = document.getElementById('feedback-message');

    // --- App State ---
    let currentNoteId = null;
    let notes = [];
    let autoSaveTimeout = null;

    const NOTES_STORAGE_KEY = 'pixelCornellNotes';
    const DRAFT_STORAGE_KEY = 'pixelCornellDraftNote';
    const THEME_STORAGE_KEY = 'pixelCornellTheme';

    // --- Utility Functions ---
    const generateId = () => `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const debounce = (func, delay) => {
        return (...args) => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- Storage Manager ---
    const StorageManager = {
        getNotes: () => {
            const notesJson = localStorage.getItem(NOTES_STORAGE_KEY);
            return notesJson ? JSON.parse(notesJson) : [];
        },
        saveNotes: (notesToSave) => {
            localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesToSave));
        },
        saveDraft: (draftNote) => {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftNote));
        },
        getDraft: () => {
            const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
            return draftJson ? JSON.parse(draftJson) : null;
        },
        clearDraft: () => {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
        },
        saveTheme: (theme) => {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        },
        getTheme: () => {
            return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
        }
    };

    // --- UI Manager ---
    const UIManager = {
        renderNoteList: () => {
            notesListUl.innerHTML = '';
            if (notes.length === 0) {
                notesListUl.innerHTML = '<li>No notes yet.</li>';
                return;
            }
            notes.sort((a, b) => b.lastModified - a.lastModified); // Show newest first
            notes.forEach(note => {
                const li = document.createElement('li');
                li.textContent = note.title || 'Untitled Note';
                li.dataset.id = note.id;
                if (note.id === currentNoteId) {
                    li.classList.add('active-note');
                }
                li.addEventListener('click', () => handleSelectNote(note.id));
                notesListUl.appendChild(li);
            });
        },
        displayNote: (note) => {
            if (!note) {
                UIManager.clearForm();
                return;
            }
            noteTitleInput.value = note.title || '';
            cuesInput.value = note.cues || '';
            mainNotesInput.value = note.main || '';
            summaryInput.value = note.summary || '';
            currentNoteId = note.id;
            deleteNoteButton.disabled = false;
            exportMdButton.disabled = false;
            UIManager.highlightActiveListItem(note.id);
        },
        clearForm: (resetId = true) => {
            noteTitleInput.value = '';
            cuesInput.value = '';
            mainNotesInput.value = '';
            summaryInput.value = '';
            if (resetId) {
                currentNoteId = null;
            }
            deleteNoteButton.disabled = true;
            exportMdButton.disabled = true;
            UIManager.highlightActiveListItem(null);
            noteTitleInput.focus();
        },
        showFeedback: (message, type = 'info', duration = 3000) => {
            feedbackMessageEl.textContent = message;
            feedbackMessageEl.className = `feedback-message ${type}`;
            setTimeout(() => {
                feedbackMessageEl.textContent = '';
                feedbackMessageEl.className = 'feedback-message';
            }, duration);
        },
        highlightActiveListItem: (noteId) => {
            document.querySelectorAll('#notes-list li').forEach(li => {
                li.classList.remove('active-note');
                if (li.dataset.id === noteId) {
                    li.classList.add('active-note');
                }
            });
        },
        applyTheme: (theme) => {
            document.body.classList.toggle('dark-mode', theme === 'dark');
            themeToggleButton.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
        }
    };

    // --- Event Handlers ---
    const handleNewNote = () => {
        saveCurrentDraft(); // Save any pending changes from previous note
        StorageManager.clearDraft(); // Clear draft as we are making a new one
        UIManager.clearForm();
        currentNoteId = generateId(); // Pre-assign ID for auto-save
        UIManager.showFeedback('New note started. Type and save!', 'info');
    };

    const handleSaveNote = () => {
        const title = noteTitleInput.value.trim() || 'Untitled Note';
        const cues = cuesInput.value.trim();
        const main = mainNotesInput.value.trim();
        const summary = summaryInput.value.trim();

        if (!title && !cues && !main && !summary) {
            UIManager.showFeedback('Cannot save an empty note.', 'error');
            return;
        }

        const noteToSave = {
            id: currentNoteId || generateId(),
            title,
            cues,
            main,
            summary,
            lastModified: Date.now()
        };

        const existingNoteIndex = notes.findIndex(note => note.id === noteToSave.id);
        if (existingNoteIndex > -1) {
            notes[existingNoteIndex] = noteToSave;
        } else {
            notes.push(noteToSave);
        }
        currentNoteId = noteToSave.id; // Ensure currentNoteId is set to the saved note

        StorageManager.saveNotes(notes);
        StorageManager.clearDraft(); // Clear draft after successful save
        UIManager.renderNoteList();
        UIManager.displayNote(noteToSave); // Refresh display to ensure active state is correct
        UIManager.showFeedback('Note saved successfully!', 'success');
    };

    const handleDeleteNote = () => {
        if (!currentNoteId) {
            UIManager.showFeedback('No note selected to delete.', 'error');
            return;
        }
        if (confirm(`Are you sure you want to delete "${noteTitleInput.value || 'this note'}"?`)) {
            notes = notes.filter(note => note.id !== currentNoteId);
            StorageManager.saveNotes(notes);
            StorageManager.clearDraft(); // Also clear draft if it was the deleted note
            UIManager.clearForm();
            UIManager.renderNoteList();
            UIManager.showFeedback('Note deleted.', 'info');
        }
    };

    const handleSelectNote = (noteId) => {
        saveCurrentDraft(); // Save draft of potentially unsaved changes from previously viewed note
        const selectedNote = notes.find(note => note.id === noteId);
        if (selectedNote) {
            UIManager.displayNote(selectedNote);
            StorageManager.clearDraft(); // Clear draft as we've loaded a saved note
        }
    };

    const handleExportMd = () => {
        if (!currentNoteId) {
            UIManager.showFeedback('No note selected to export.', 'error');
            return;
        }
        const note = notes.find(n => n.id === currentNoteId);
        if (!note) {
            UIManager.showFeedback('Could not find the current note for export.', 'error');
            return;
        }

        const mdContent = `
# ${note.title || 'Untitled Note'}

## Cues / Questions
${note.cues || ''}

## Main Notes
${note.main || ''}

## Summary
${note.summary || ''}
        `.trim();

        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const fileName = (note.title || 'note').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${fileName}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        UIManager.showFeedback('Note exported as Markdown!', 'success');
    };

    const handleThemeToggle = () => {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        UIManager.applyTheme(newTheme);
        StorageManager.saveTheme(newTheme);
    };

    const autoSaveCurrentNote = debounce(() => {
        if (noteTitleInput.value.trim() === "" && cuesInput.value.trim() === "" && mainNotesInput.value.trim() === "" && summaryInput.value.trim() === "") {
            // Don't autosave if all fields are effectively empty and it's a new note
            if (!notes.find(n => n.id === currentNoteId)) {
                 StorageManager.clearDraft(); // Clear draft if it was for this new, now empty, note
                 return;
            }
        }

        const draftNote = {
            id: currentNoteId || generateId(), // Use current ID or generate if new
            title: noteTitleInput.value,
            cues: cuesInput.value,
            main: mainNotesInput.value,
            summary: summaryInput.value,
            lastModified: Date.now() // For draft context
        };
        StorageManager.saveDraft(draftNote);
        if (!currentNoteId) currentNoteId = draftNote.id; // Ensure a new draft gets an ID immediately
        UIManager.showFeedback('Draft auto-saved.', 'info', 1500);
    }, 1500); // Auto-save after 1.5 seconds of inactivity

    const saveCurrentDraft = () => { // Save draft immediately without debounce
        if (noteTitleInput.value.trim() === "" && cuesInput.value.trim() === "" && mainNotesInput.value.trim() === "" && summaryInput.value.trim() === "") {
             // Don't save draft if all fields are effectively empty and it's a new note
            if (!notes.find(n => n.id === currentNoteId)) {
                 StorageManager.clearDraft();
                 return;
            }
        }
        const draftNote = {
            id: currentNoteId || generateId(),
            title: noteTitleInput.value,
            cues: cuesInput.value,
            main: mainNotesInput.value,
            summary: summaryInput.value,
            lastModified: Date.now()
        };
        StorageManager.saveDraft(draftNote);
        if (!currentNoteId) currentNoteId = draftNote.id;
    };


    const loadDraftIfAny = () => {
        const draft = StorageManager.getDraft();
        if (draft) {
            if (confirm("You have an unsaved draft. Would you like to restore it?")) {
                UIManager.displayNote(draft); // This sets currentNoteId from draft
                UIManager.showFeedback('Draft restored.', 'info');
            } else {
                StorageManager.clearDraft(); // User chose not to restore
            }
        }
    };

    // --- Initialization ---
    const init = () => {
        // Load and apply theme first
        const savedTheme = StorageManager.getTheme();
        UIManager.applyTheme(savedTheme);

        notes = StorageManager.getNotes();
        loadDraftIfAny(); // Check for draft before rendering full list or a new note

        // If no draft was loaded and no currentNoteId is set, prepare for new note or select first
        if (!currentNoteId) {
            if (notes.length > 0) {
                // If no draft, and notes exist, load the most recent one
                // Sort by lastModified to get the most recent
                const mostRecentNote = [...notes].sort((a,b) => b.lastModified - a.lastModified)[0];
                handleSelectNote(mostRecentNote.id);
            } else {
                // No draft, no notes, start fresh
                handleNewNote(); // This generates a new ID for the blank slate
            }
        }

        UIManager.renderNoteList();
        if (currentNoteId && !StorageManager.getDraft()) { // If a specific note was loaded (not a draft)
            const noteToDisplay = notes.find(n => n.id === currentNoteId);
            if (noteToDisplay) UIManager.displayNote(noteToDisplay);
            else handleNewNote(); // Fallback if somehow currentNoteId is stale
        } else if (!currentNoteId && !StorageManager.getDraft()) { // If no note is active and no draft
            handleNewNote();
        }


        // Event Listeners
        newNoteButton.addEventListener('click', handleNewNote);
        saveNoteButton.addEventListener('click', handleSaveNote);
        deleteNoteButton.addEventListener('click', handleDeleteNote);
        exportMdButton.addEventListener('click', handleExportMd);
        themeToggleButton.addEventListener('click', handleThemeToggle);

        [noteTitleInput, cuesInput, mainNotesInput, summaryInput].forEach(input => {
            input.addEventListener('input', autoSaveCurrentNote);
        });

        // Disable delete/export buttons initially if no note is loaded
        if (!currentNoteId) {
            deleteNoteButton.disabled = true;
            exportMdButton.disabled = true;
        }
    };

    init();
});
