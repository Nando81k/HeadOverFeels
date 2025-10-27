/**
 * Customer Notes Component
 * 
 * Manage internal notes for a customer
 * - Add new notes
 * - Edit existing notes
 * - Delete notes
 * - Mark notes as important
 */

'use client';

import { useState } from 'react';
import { addCustomerNote, updateCustomerNote, deleteCustomerNote } from '@/lib/api/customers';

interface Note {
  id: string;
  content: string;
  authorName: string;
  isImportant: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerNotesProps {
  customerId: string;
  initialNotes: Note[];
  onNotesChange?: () => void;
}

export function CustomerNotes({ customerId, initialNotes, onNotesChange }: CustomerNotesProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteImportant, setNewNoteImportant] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImportant, setEditImportant] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddNote() {
    if (!newNoteContent.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await addCustomerNote(customerId, newNoteContent, newNoteImportant);
      
      if (response.success && response.data) {
        setNotes([response.data, ...notes]);
        setNewNoteContent('');
        setNewNoteImportant(false);
        onNotesChange?.();
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateNote(noteId: string) {
    if (!editContent.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await updateCustomerNote(customerId, noteId, editContent, editImportant);
      
      if (response.success && response.data) {
        setNotes(notes.map(note => note.id === noteId ? response.data! : note));
        setEditingNoteId(null);
        setEditContent('');
        setEditImportant(false);
        onNotesChange?.();
      }
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      setIsSubmitting(true);
      await deleteCustomerNote(customerId, noteId);
      setNotes(notes.filter(note => note.id !== noteId));
      onNotesChange?.();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(note: Note) {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditImportant(note.isImportant);
  }

  function cancelEditing() {
    setEditingNoteId(null);
    setEditContent('');
    setEditImportant(false);
  }

  return (
    <div className="space-y-4">
      {/* Add New Note Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Add Note</h3>
        <textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Add a note about this customer..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
          disabled={isSubmitting}
        />
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newNoteImportant}
              onChange={(e) => setNewNoteImportant(e.target.checked)}
              className="rounded border-gray-300 text-gray-800 focus:ring-gray-800"
              disabled={isSubmitting}
            />
            <span className="text-sm text-gray-700">Mark as important</span>
          </label>
          <button
            onClick={handleAddNote}
            disabled={!newNoteContent.trim() || isSubmitting}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Notes ({notes.length})</h3>
        
        {notes.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
            No notes yet. Add a note to track important information about this customer.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`bg-white rounded-lg border p-4 ${
                note.isImportant ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
              }`}
            >
              {editingNoteId === note.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none"
                    disabled={isSubmitting}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editImportant}
                        onChange={(e) => setEditImportant(e.target.checked)}
                        className="rounded border-gray-300 text-gray-800 focus:ring-gray-800"
                        disabled={isSubmitting}
                      />
                      <span className="text-sm text-gray-700">Mark as important</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEditing}
                        disabled={isSubmitting}
                        className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateNote(note.id)}
                        disabled={!editContent.trim() || isSubmitting}
                        className="px-3 py-1 text-sm bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{note.authorName}</span>
                      {note.isImportant && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded">
                          Important
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditing(note)}
                        className="text-sm text-gray-600 hover:text-gray-900"
                        disabled={isSubmitting}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-sm text-red-600 hover:text-red-900"
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>Created: {new Date(note.createdAt).toLocaleString()}</span>
                    {note.updatedAt !== note.createdAt && (
                      <span>Updated: {new Date(note.updatedAt).toLocaleString()}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
