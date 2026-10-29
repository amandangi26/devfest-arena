import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import {
  importAttendees,
  formatDisplayName,
  normalizeEmail,
  normalizePhone,
  normalizeTrackId,
} from '../services/attendeeImportService.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { roomOrchestrator } from '../services/roomOrchestrator.js';

export const attendeeRouter = Router();

const createSingleAttendeeSchema = z.object({
  uniqueCode: z.string().trim().min(3, 'Ticket code must be at least 3 characters').max(30).optional().or(z.literal('')),
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Valid email address is required').max(150),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\-\s]?)?[6-9]\d{9}$/, 'Must be a valid 10-digit mobile number')
    .optional()
    .or(z.literal('')),
  organization: z.string().trim().max(100).optional().or(z.literal('')),
  designation: z.string().trim().max(100).optional().or(z.literal('')),
  track: z.string().trim().max(50).optional().or(z.literal('')),
});

/**
 * POST /api/attendees
 * Manual on-the-ground single attendee registration (e.g. walk-ins, spot registrations).
 * Restricted to Event Administrators.
 */
attendeeRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const parseResult = createSingleAttendeeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Invalid attendee input data.',
          details: parseResult.error.format(),
        },
      });
    }

    const { name, email, phone, organization, designation, track } = parseResult.data;
    let uniqueCode = parseResult.data.uniqueCode?.toUpperCase().trim();

    // Auto-generate spot code if not provided
    if (!uniqueCode) {
      let attempts = 0;
      do {
        const rand = Math.floor(100 + Math.random() * 900);
        uniqueCode = `DFR26-W${rand}`;
        const existing = await db.findAttendeeByUniqueCode(uniqueCode);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);
    } else {
      const existing = await db.findAttendeeByUniqueCode(uniqueCode);
      if (existing) {
        return res.status(409).json({
          error: {
            code: 'DUPLICATE_UNIQUE_CODE',
            message: `Ticket code "${uniqueCode}" is already assigned to ${existing.name}.`,
          },
        });
      }
    }

    const now = Date.now();
    const attendeeId = `att_${crypto.randomBytes(8).toString('hex')}`;
    const emailNorm = normalizeEmail(email);
    const phoneNorm = normalizePhone(phone);
    const trackId = normalizeTrackId(track || 'all');
    const displayName = formatDisplayName(name);

    const attendeeRecord = {
      id: attendeeId,
      event_id: config.eventId,
      unique_code: uniqueCode,
      name: name.trim(),
      display_name: displayName,
      email_normalized: emailNorm,
      phone_normalized: phoneNorm,
      organization: organization ? organization.trim() : 'Spot Registrant',
      designation: designation ? designation.trim() : 'Attendee',
      registration_status: 'confirmed',
      attendance_status: 'checked_in', // On-the-spot manual registration is present at venue
      ticket_verified_at: null,
      checked_in_at: now,
      created_at: now,
      updated_at: now,
    };

    const saved = await db.upsertAttendee(attendeeRecord);

    await db.addAttendeeTrack({
      id: `trk_${crypto.randomBytes(8).toString('hex')}`,
      attendee_id: attendeeId,
      unique_code: uniqueCode,
      track_id: trackId,
      source_import_id: 'manual_spot',
      assigned_at: now,
    });

    res.status(201).json({
      ok: true,
      attendee: saved,
      message: `Attendee ${displayName} (${uniqueCode}) registered successfully.`,
    });
  } catch (err) {
    next(err);
  }
});

const importSchema = z.object({
  csvText: z.string().optional(),
  rawRows: z.array(z.record(z.string(), z.any())).optional(),
  sourceImportId: z.string().optional(),
});

/**
 * POST /api/attendees/import
 * Ingests Commudle / Google Forms CSV exports with validation & quarantine report.
 * Restricted to Event Administrators.
 */
attendeeRouter.post('/import', requireAdmin, async (req, res, next) => {
  try {
    const parseResult = importSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'CSV text or raw rows array is required for import.',
          details: parseResult.error.format(),
        },
      });
    }

    const { csvText, rawRows, sourceImportId } = parseResult.data;
    if (!csvText && (!rawRows || rawRows.length === 0)) {
      return res.status(400).json({
        error: {
          code: 'EMPTY_PAYLOAD',
          message: 'Provide csvText string or rawRows array.',
        },
      });
    }

    const report = await importAttendees({
      csvText,
      rawRows,
      sourceImportId: sourceImportId || `import_${Date.now()}`,
    });

    res.json({
      ok: true,
      report,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attendees
 * Lists imported attendees with pagination.
 * Restricted to Event Administrators.
 */
attendeeRouter.get('/', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    const result = await db.listAttendees(limit, offset);
    res.json({
      ok: true,
      data: result.data,
      total: result.total,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attendees/:uniqueCode/check-in
 * Marks physical entrance check-in at Radisson Blu venue.
 * Strictly separate from ticket verification!
 */
attendeeRouter.post('/:uniqueCode/check-in', requireAdmin, async (req, res, next) => {
  try {
    const uniqueCode = req.params.uniqueCode?.toUpperCase().trim();
    const attendee = await db.findAttendeeByUniqueCode(uniqueCode);

    if (!attendee) {
      return res.status(404).json({
        error: {
          code: 'ATTENDEE_NOT_FOUND',
          message: `No attendee found for ticket code: ${uniqueCode}`,
        },
      });
    }

    const now = Date.now();
    const updated = await db.upsertAttendee({
      ...attendee,
      attendance_status: 'checked_in',
      checked_in_at: now,
    });

    await db.logAuditEvent({
      id: `audit_checkin_${now}`,
      admin_id: 'operator',
      action: 'VENUE_CHECK_IN',
      target_id: attendee.id,
      details: { uniqueCode },
    });

    res.json({
      ok: true,
      attendee: {
        uniqueCode: updated.unique_code,
        name: updated.name,
        attendanceStatus: updated.attendance_status,
        checkedInAt: updated.checked_in_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Please select at least one attendee to delete.'),
});

/**
 * POST /api/attendees/bulk-delete
 * Bulk deletes attendees selected by administrators.
 */
attendeeRouter.post('/bulk-delete', requireAdmin, async (req, res, next) => {
  try {
    const parseResult = bulkDeleteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Invalid attendee deletion selection.',
        },
      });
    }

    const { ids } = parseResult.data;

    // Disconnect any active lobby instances for these attendees
    for (const idOrCode of ids) {
      for (const room of roomOrchestrator.rooms.values()) {
        roomOrchestrator.removeAttendee(room.roomCode, idOrCode);
      }
    }

    const deletedCount = await db.deleteAttendeesBulk(ids);

    await db.logAuditEvent({
      id: `audit_bulk_del_${Date.now()}`,
      admin_id: req.adminId || 'operator',
      action: 'BULK_DELETE_ATTENDEES',
      target_id: 'multiple',
      details: { count: deletedCount, requestedCount: ids.length },
    });

    res.json({
      ok: true,
      deletedCount,
      message: `Successfully deleted ${deletedCount} attendee(s).`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/attendees/:idOrCode
 * Deletes a single attendee by ID or unique ticket code.
 */
attendeeRouter.delete('/:idOrCode', requireAdmin, async (req, res, next) => {
  try {
    const idOrCode = req.params.idOrCode?.trim();
    if (!idOrCode) {
      return res.status(400).json({ error: { message: 'Attendee ID or Ticket Code required.' } });
    }

    // Disconnect attendee from active room lobbies if present
    for (const room of roomOrchestrator.rooms.values()) {
      roomOrchestrator.removeAttendee(room.roomCode, idOrCode);
    }

    const deleted = await db.deleteAttendee(idOrCode);
    if (!deleted) {
      return res.status(404).json({ error: { message: `Attendee "${idOrCode}" not found.` } });
    }

    await db.logAuditEvent({
      id: `audit_del_${Date.now()}`,
      admin_id: req.adminId || 'operator',
      action: 'DELETE_ATTENDEE',
      target_id: idOrCode,
      details: { idOrCode },
    });

    res.json({
      ok: true,
      message: `Attendee deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
});
