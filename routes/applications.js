const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /applications/job/:jobId - Apply for job (Job Seeker)
router.post('/job/:jobId', authMiddleware, requireRole('JOB_SEEKER'), async (req, res) => {
  try {
    const { coverLetter } = req.body;
    const jobId = req.params.jobId;

    console.log('📥 Application request:', { jobId, userId: req.user.userId });

    // Check if job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if already applied
    const existing = await prisma.application.findUnique({
      where: {
        userId_jobId: {
          userId: req.user.userId,
          jobId: jobId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Already applied to this job' });
    }

    const application = await prisma.application.create({
      data: {
        coverLetter,
        userId: req.user.userId,
        jobId: jobId
      }
    });

    console.log('✅ Application submitted:', { id: application.id });

    res.status(201).json({ message: 'Application submitted', application });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /applications/my-applications - Get my applications (Job Seeker)
router.get('/my-applications', authMiddleware, requireRole('JOB_SEEKER'), async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { userId: req.user.userId },
      include: {
        job: {
          include: {
            recruiter: { select: { name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /applications/:id - Get single application
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        job: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check authorization
    if (req.user.role === 'JOB_SEEKER' && application.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'RECRUITER' && application.job.recruiterId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /applications/:id/status - Update application status (Recruiter)
router.patch('/:id/status', authMiddleware, requireRole('RECRUITER'), async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status
    const validStatuses = ['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { job: true }
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.job.recruiterId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updated = await prisma.application.update({
      where: { id: req.params.id },
      data: { status }
    });

    console.log('✅ Application status updated:', { id: updated.id, status: updated.status });

    res.json({ message: 'Status updated', application: updated });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /applications/:id - Withdraw application (Job Seeker)
router.delete('/:id', authMiddleware, requireRole('JOB_SEEKER'), async (req, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id }
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.application.delete({ where: { id: req.params.id } });

    console.log('✅ Application withdrawn:', { id: req.params.id });

    res.json({ message: 'Application withdrawn' });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
