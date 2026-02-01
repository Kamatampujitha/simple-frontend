const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

const JOB_CATEGORIES = ['frontend', 'backend', 'fullstack'];

function normalizeCategory(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  if (!value) return null;
  if (!JOB_CATEGORIES.includes(value)) return null;
  return value;
}

// GET /jobs - Get all jobs (Public)
router.get('/', async (req, res) => {
  try {
    const roleQuery = req.query.role ?? req.query.category;
    const category = normalizeCategory(roleQuery);
    if (roleQuery != null && category == null) {
      return res.status(400).json({
        message: `Invalid role. Use one of: ${JOB_CATEGORIES.join(', ')}`
      });
    }

    const jobs = await prisma.job.findMany({
      ...(category ? { where: { category } } : {}),
      include: {
        recruiter: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /jobs/my-jobs - Get recruiter's jobs
router.get('/my-jobs', authMiddleware, requireRole('RECRUITER'), async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { recruiterId: req.user.userId },
      include: {
        _count: { select: { applications: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ jobs });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /jobs/:id - Get single job
router.get('/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        recruiter: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /jobs - Create job (Recruiter only)
router.post('/', authMiddleware, requireRole('RECRUITER'), async (req, res) => {
  try {
    const { title, company, location, type, salary, description, requirements } = req.body;
    const category =
      normalizeCategory(req.body.role ?? req.body.category) ?? 'fullstack';

    console.log('📥 Create job request:', { title, company });

    // Validation
    if (!title || !company || !location || !salary || !description) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const job = await prisma.job.create({
      data: {
        title,
        company,
        location,
        category,
        type: type || 'FULL_TIME',
        salary,
        description,
        requirements,
        recruiterId: req.user.userId
      }
    });

    console.log('✅ Job created:', { id: job.id, title: job.title });

    res.status(201).json({ message: 'Job created', job });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /jobs/:id - Update job (Recruiter only)
router.put('/:id', authMiddleware, requireRole('RECRUITER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.recruiterId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updateData = { ...req.body };
    // Support role/category updates while avoiding Prisma "unknown argument" errors.
    const maybeCategory = normalizeCategory(updateData.role ?? updateData.category);
    if ((updateData.role != null || updateData.category != null) && !maybeCategory) {
      return res.status(400).json({
        message: `Invalid role. Use one of: ${JOB_CATEGORIES.join(', ')}`
      });
    }
    delete updateData.role;
    delete updateData.category;
    if (maybeCategory) updateData.category = maybeCategory;

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: updateData
    });

    console.log('✅ Job updated:', { id: updated.id, title: updated.title });

    res.json({ message: 'Job updated', job: updated });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /jobs/:id - Delete job (Recruiter or Admin)
router.delete('/:id', authMiddleware, requireRole('RECRUITER', 'ADMIN'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Recruiter can only delete their own jobs
    if (req.user.role === 'RECRUITER' && job.recruiterId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete related applications and saved jobs first
    await prisma.application.deleteMany({ where: { jobId: req.params.id } });
    await prisma.savedJob.deleteMany({ where: { jobId: req.params.id } });
    await prisma.job.delete({ where: { id: req.params.id } });

    console.log('✅ Job deleted:', { id: req.params.id });

    res.json({ message: 'Job deleted' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /jobs/:id/applicants - Get job applicants (Recruiter)
router.get('/:id/applicants', authMiddleware, requireRole('RECRUITER'), async (req, res) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.recruiterId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const applicants = await prisma.application.findMany({
      where: { jobId: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ applicants });
  } catch (error) {
    console.error('Get applicants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
