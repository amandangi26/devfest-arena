import { z } from 'zod';

export const optionSchema = z.object({
  id: z.string().trim().min(1, 'Option ID is required'),
  text: z.string().trim().default(''),
  mediaUrl: z.string().trim().optional().or(z.literal('')),
}).refine(
  (data) => (data.text && data.text.length > 0) || (data.mediaUrl && data.mediaUrl.length > 0),
  {
    message: 'Option must have either text or an image',
    path: ['text'],
  }
);

export const questionSchema = z.object({
  questionId: z.string().trim().optional(),
  order: z.number().int().min(1).optional(),
  prompt: z.string().trim().min(5, 'Question prompt must be at least 5 characters long'),
  codeSnippet: z.string().optional().or(z.literal('')),
  mediaUrl: z.string().trim().optional().or(z.literal('')),
  icon: z.string().default('HelpCircle'),
  options: z
    .array(optionSchema)
    .length(4, 'Synchronized MCQ questions must have exactly 4 choices (A, B, C, D)'),
  correctOptionId: z.string().trim().min(1, 'Correct option must be selected'),
  timeLimitSeconds: z
    .number()
    .int()
    .min(10, 'Time limit cannot be less than 10 seconds')
    .max(60, 'Time limit cannot exceed 60 seconds')
    .default(15),
  pointsMultiplier: z.number().min(0.5).max(3.0).default(1.0),
  explanation: z.string().optional().or(z.literal('')),
}).refine(
  (data) => data.options.some((opt) => opt.id === data.correctOptionId),
  {
    message: 'correctOptionId must match one of the 4 option IDs',
    path: ['correctOptionId'],
  }
);

export const createGameDefinitionSchema = z.object({
  title: z.string().trim().min(3, 'Game title must be at least 3 characters long').max(100),
  description: z.string().trim().max(500).optional().default(''),
  gameType: z.literal('SYNCHRONIZED_MCQ').default('SYNCHRONIZED_MCQ'),
  trackTarget: z.string().trim().default('all'),
  hallName: z.string().trim().default('Conference Hall'),
  questions: z
    .array(questionSchema)
    .max(15, 'Maximum of 15 questions allowed per quiz session')
    .optional(),
});

export const updateGameDefinitionSchema = z.object({
  title: z.string().trim().min(3, 'Game title must be at least 3 characters long').max(100).optional(),
  description: z.string().trim().max(500).optional(),
  gameType: z.literal('SYNCHRONIZED_MCQ').optional(),
  trackTarget: z.string().trim().optional(),
  hallName: z.string().trim().optional(),
  questions: z
    .array(questionSchema)
    .max(15, 'Maximum of 15 questions allowed per quiz session')
    .optional(),
});
