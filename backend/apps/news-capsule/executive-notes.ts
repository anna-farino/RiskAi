import { Request, Response } from 'express';
import { z } from 'zod';
import { withUserContext } from '../../db/with-user-context';

const createNoteSchema = z.object({
  articleId: z.string().uuid(),
  reportId: z.string().uuid(),
  note: z.string().min(1, "Note cannot be empty"),
});

const updateNoteSchema = z.object({
  noteId: z.string().uuid(),
  note: z.string().min(1, "Note cannot be empty"),
});

// Store executive notes in memory for now since we can't create the table
const executiveNotes: Array<{
  id: string;
  articleId: string;
  reportId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}> = [];

let noteIdCounter = 1;

export async function createExecutiveNote(req: Request, res: Response) {
  try {
    const result = createNoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues });
    }

    const { articleId, reportId, note } = result.data;

    await withUserContext(async (db, user) => {
      const noteId = `note-${noteIdCounter++}`;
      const now = new Date().toISOString();

      const newNote = {
        id: noteId,
        articleId,
        reportId,
        note,
        createdAt: now,
        updatedAt: now,
        userId: user.id,
      };

      executiveNotes.push(newNote);

      res.json({
        success: true,
        note: newNote
      });
    }, req);
  } catch (error) {
    console.error('Error creating executive note:', error);
    res.status(500).json({ error: 'Failed to create executive note' });
  }
}

export async function getExecutiveNotes(req: Request, res: Response) {
  try {
    const { reportId } = req.params;

    await withUserContext(async (db, user) => {
      const reportNotes = executiveNotes.filter(
        note => note.reportId === reportId && note.userId === user.id
      );

      res.json({
        success: true,
        notes: reportNotes
      });
    }, req);
  } catch (error) {
    console.error('Error fetching executive notes:', error);
    res.status(500).json({ error: 'Failed to fetch executive notes' });
  }
}

export async function updateExecutiveNote(req: Request, res: Response) {
  try {
    const result = updateNoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues });
    }

    const { noteId, note } = result.data;

    await withUserContext(async (db, user) => {
      const noteIndex = executiveNotes.findIndex(
        n => n.id === noteId && n.userId === user.id
      );

      if (noteIndex === -1) {
        return res.status(404).json({ error: 'Note not found' });
      }

      executiveNotes[noteIndex].note = note;
      executiveNotes[noteIndex].updatedAt = new Date().toISOString();

      res.json({
        success: true,
        note: executiveNotes[noteIndex]
      });
    }, req);
  } catch (error) {
    console.error('Error updating executive note:', error);
    res.status(500).json({ error: 'Failed to update executive note' });
  }
}

export async function deleteExecutiveNote(req: Request, res: Response) {
  try {
    const { noteId } = req.params;

    await withUserContext(async (db, user) => {
      const noteIndex = executiveNotes.findIndex(
        n => n.id === noteId && n.userId === user.id
      );

      if (noteIndex === -1) {
        return res.status(404).json({ error: 'Note not found' });
      }

      executiveNotes.splice(noteIndex, 1);

      res.json({
        success: true,
        message: 'Note deleted successfully'
      });
    }, req);
  } catch (error) {
    console.error('Error deleting executive note:', error);
    res.status(500).json({ error: 'Failed to delete executive note' });
  }
}