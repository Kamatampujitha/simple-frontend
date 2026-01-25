const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /saved-jobs/:jobId - Save a job
router.post('/:jobId', authMiddleware, requireRole('JOB_SEEKER'), async (req, res) => {
  try {
    const jobId = req.params.jobId;

    // Check if job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if already saved
    const existing = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: req.user.userId,
          jobId: jobId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Job already saved' });
    }

    await prisma.savedJob.create({
      data: {
        userId: req.user.userId,
        jobId: jobId
      }
    });

    console.log('✅ Job saved:', { jobId, userId: req.user.userId });

    res.json({ message: 'Job saved' });
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /saved-jobs - Get saved jobs
router.get('/', authMiddleware, requireRole('JOB_SEEKER'), async (req, res) => {
  try {
    const savedJobs = await prisma.savedJob.findMany({
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

    res.json({ savedJobs });
  } catch (error) {
    console.error('Get saved jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /saved-jobs/:jobId - Remove saved job
router.delete('/:jobId', authMiddleware, requireRole('JOB_SEEKER'), async (req, res) => {
  try {
    const jobId = req.params.jobId;

    const savedJob = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: req.user.userId,
          jobId: jobId
        }
      }
    });

    if (!savedJob) {
      return res.status(404).json({ message: 'Saved job not found' });
    }

    await prisma.savedJob.delete({
      where: {
        userId_jobId: {
          userId: req.user.userId,
          jobId: jobId
        }
      }
    });

    console.log('✅ Job removed from saved:', { jobId });

    res.json({ message: 'Job removed from saved' });
  } catch (error) {
    console.error('Remove saved job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /saved-jobs/check/:jobId - Check if job is saved
router.get('/check/:jobId', authMiddleware, requireRole('JOB_SEEKER'), async (req, res) => {
  try {
    const savedJob = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: req.user.userId,
          jobId: req.params.jobId
        }
      }
    });

    res.json({ isSaved: !!savedJob });
  } catch (error) {
    console.error('Check saved job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
