const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /admin/stats - Get dashboard stats
router.get('/stats', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const [userCount, jobCount, applicationCount] = await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.application.count()
    ]);

    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });

    res.json({
      stats: {
        totalUsers: userCount,
        totalJobs: jobCount,
        totalApplications: applicationCount,
        usersByRole
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/users - Get all users
router.get('/users', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            jobs: true,
            applications: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /admin/users/:id/role - Update user role
router.patch('/users/:id/role', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { role } = req.body;

    // Validate role
    const validRoles = ['JOB_SEEKER', 'RECRUITER', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true }
    });

    console.log('✅ User role updated:', { id: user.id, role: user.role });

    res.json({ message: 'Role updated', user });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /admin/users/:id - Delete user
router.delete('/users/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    // Delete related data first
    await prisma.application.deleteMany({ where: { userId: req.params.id } });
    await prisma.savedJob.deleteMany({ where: { userId: req.params.id } });
    
    // Delete jobs posted by user (if recruiter)
    const userJobs = await prisma.job.findMany({ where: { recruiterId: req.params.id } });
    for (const job of userJobs) {
      await prisma.application.deleteMany({ where: { jobId: job.id } });
      await prisma.savedJob.deleteMany({ where: { jobId: job.id } });
    }
    await prisma.job.deleteMany({ where: { recruiterId: req.params.id } });

    // Delete user
    await prisma.user.delete({ where: { id: req.params.id } });

    console.log('✅ User deleted:', { id: req.params.id });

    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/jobs - Get all jobs
router.get('/jobs', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
        _count: { select: { applications: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /admin/jobs/:id - Delete any job
router.delete('/jobs/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    // Delete related data first
    await prisma.application.deleteMany({ where: { jobId: req.params.id } });
    await prisma.savedJob.deleteMany({ where: { jobId: req.params.id } });
    await prisma.job.delete({ where: { id: req.params.id } });

    console.log('✅ Job deleted by admin:', { id: req.params.id });

    res.json({ message: 'Job deleted' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /admin/applications - Get all applications
router.get('/applications', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        job: { select: { id: true, title: true, company: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
