const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'resume' ? 'uploads/resumes' : 'uploads/avatars';
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'resume') {
    // Allow PDF, DOC, DOCX
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX files are allowed for resume'), false);
    }
  } else if (file.fieldname === 'avatar') {
    // Allow images
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF files are allowed for avatar'), false);
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ==================== PROFILE ROUTES ====================

// GET /profile - Get my profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    let profile = await prisma.profile.findUnique({
      where: { userId: req.user.userId },
      include: {
        experiences: { orderBy: { startDate: 'desc' } },
        education: { orderBy: { startYear: 'desc' } },
        user: { select: { email: true, name: true } }
      }
    });

    // If no profile exists, create one
    if (!profile) {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      profile = await prisma.profile.create({
        data: {
          userId: req.user.userId,
          name: user.name
        },
        include: {
          experiences: true,
          education: true,
          user: { select: { email: true, name: true } }
        }
      });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /profile/:userId - Get profile by user ID (public)
router.get('/:userId', async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.params.userId },
      include: {
        experiences: { orderBy: { startDate: 'desc' } },
        education: { orderBy: { startYear: 'desc' } },
        user: { select: { email: true, name: true } }
      }
    });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get profile by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /profile/basic - Update basic info
router.put('/basic', authMiddleware, async (req, res) => {
  try {
    const { name, headline, location, phone } = req.body;

    const profile = await prisma.profile.upsert({
      where: { userId: req.user.userId },
      update: { name, headline, location, phone },
      create: {
        userId: req.user.userId,
        name,
        headline,
        location,
        phone
      },
      include: {
        experiences: true,
        education: true
      }
    });

    console.log('✅ Profile basic info updated:', { userId: req.user.userId });

    res.json({ message: 'Profile updated', profile });
  } catch (error) {
    console.error('Update basic info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /profile/about - Update about section
router.put('/about', authMiddleware, async (req, res) => {
  try {
    const { about } = req.body;

    const profile = await prisma.profile.upsert({
      where: { userId: req.user.userId },
      update: { about },
      create: {
        userId: req.user.userId,
        about
      }
    });

    console.log('✅ Profile about updated:', { userId: req.user.userId });

    res.json({ message: 'About section updated', profile });
  } catch (error) {
    console.error('Update about error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /profile/skills - Update skills
router.put('/skills', authMiddleware, async (req, res) => {
  try {
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({ message: 'Skills must be an array' });
    }

    const profile = await prisma.profile.upsert({
      where: { userId: req.user.userId },
      update: { skills },
      create: {
        userId: req.user.userId,
        skills
      }
    });

    console.log('✅ Profile skills updated:', { userId: req.user.userId, skillsCount: skills.length });

    res.json({ message: 'Skills updated', profile });
  } catch (error) {
    console.error('Update skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== EXPERIENCE ROUTES ====================

// POST /profile/experience - Add experience
router.post('/experience', authMiddleware, async (req, res) => {
  try {
    const { title, company, location, startDate, endDate, current, description } = req.body;

    if (!title || !company || !startDate) {
      return res.status(400).json({ message: 'Title, company, and start date are required' });
    }

    // Ensure profile exists
    let profile = await prisma.profile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) {
      profile = await prisma.profile.create({
        data: { userId: req.user.userId }
      });
    }

    const experience = await prisma.experience.create({
      data: {
        profileId: profile.id,
        title,
        company,
        location,
        startDate,
        endDate: current ? null : endDate,
        current: current || false,
        description
      }
    });

    console.log('✅ Experience added:', { id: experience.id, title });

    res.status(201).json({ message: 'Experience added', experience });
  } catch (error) {
    console.error('Add experience error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /profile/experience/:id - Update experience
router.put('/experience/:id', authMiddleware, async (req, res) => {
  try {
    const { title, company, location, startDate, endDate, current, description } = req.body;

    // Verify ownership
    const existing = await prisma.experience.findUnique({
      where: { id: req.params.id },
      include: { profile: true }
    });

    if (!existing || existing.profile.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const experience = await prisma.experience.update({
      where: { id: req.params.id },
      data: {
        title,
        company,
        location,
        startDate,
        endDate: current ? null : endDate,
        current: current || false,
        description
      }
    });

    console.log('✅ Experience updated:', { id: experience.id });

    res.json({ message: 'Experience updated', experience });
  } catch (error) {
    console.error('Update experience error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /profile/experience/:id - Delete experience
router.delete('/experience/:id', authMiddleware, async (req, res) => {
  try {
    // Verify ownership
    const existing = await prisma.experience.findUnique({
      where: { id: req.params.id },
      include: { profile: true }
    });

    if (!existing || existing.profile.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.experience.delete({ where: { id: req.params.id } });

    console.log('✅ Experience deleted:', { id: req.params.id });

    res.json({ message: 'Experience deleted' });
  } catch (error) {
    console.error('Delete experience error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== EDUCATION ROUTES ====================

// POST /profile/education - Add education
router.post('/education', authMiddleware, async (req, res) => {
  try {
    const { institution, degree, fieldOfStudy, startYear, endYear, grade } = req.body;

    if (!institution || !degree || !fieldOfStudy || !startYear) {
      return res.status(400).json({ message: 'Institution, degree, field of study, and start year are required' });
    }

    // Ensure profile exists
    let profile = await prisma.profile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) {
      profile = await prisma.profile.create({
        data: { userId: req.user.userId }
      });
    }

    const education = await prisma.education.create({
      data: {
        profileId: profile.id,
        institution,
        degree,
        fieldOfStudy,
        startYear,
        endYear,
        grade
      }
    });

    console.log('✅ Education added:', { id: education.id, institution });

    res.status(201).json({ message: 'Education added', education });
  } catch (error) {
    console.error('Add education error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /profile/education/:id - Update education
router.put('/education/:id', authMiddleware, async (req, res) => {
  try {
    const { institution, degree, fieldOfStudy, startYear, endYear, grade } = req.body;

    // Verify ownership
    const existing = await prisma.education.findUnique({
      where: { id: req.params.id },
      include: { profile: true }
    });

    if (!existing || existing.profile.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const education = await prisma.education.update({
      where: { id: req.params.id },
      data: {
        institution,
        degree,
        fieldOfStudy,
        startYear,
        endYear,
        grade
      }
    });

    console.log('✅ Education updated:', { id: education.id });

    res.json({ message: 'Education updated', education });
  } catch (error) {
    console.error('Update education error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /profile/education/:id - Delete education
router.delete('/education/:id', authMiddleware, async (req, res) => {
  try {
    // Verify ownership
    const existing = await prisma.education.findUnique({
      where: { id: req.params.id },
      include: { profile: true }
    });

    if (!existing || existing.profile.userId !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.education.delete({ where: { id: req.params.id } });

    console.log('✅ Education deleted:', { id: req.params.id });

    res.json({ message: 'Education deleted' });
  } catch (error) {
    console.error('Delete education error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== RESUME ROUTES ====================

// POST /profile/resume - Upload resume
router.post('/resume', authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const resumeUrl = `/uploads/resumes/${req.file.filename}`;

    const profile = await prisma.profile.upsert({
      where: { userId: req.user.userId },
      update: {
        resume: resumeUrl,
        resumeName: req.file.originalname,
        resumeUpdatedAt: new Date()
      },
      create: {
        userId: req.user.userId,
        resume: resumeUrl,
        resumeName: req.file.originalname,
        resumeUpdatedAt: new Date()
      }
    });

    console.log('✅ Resume uploaded:', { userId: req.user.userId, filename: req.file.originalname });

    res.json({
      message: 'Resume uploaded',
      resume: {
        url: resumeUrl,
        name: req.file.originalname,
        updatedAt: profile.resumeUpdatedAt
      }
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /profile/resume - Delete resume
router.delete('/resume', authMiddleware, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.userId } });

    if (!profile || !profile.resume) {
      return res.status(404).json({ message: 'No resume found' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '..', profile.resume);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.profile.update({
      where: { userId: req.user.userId },
      data: {
        resume: null,
        resumeName: null,
        resumeUpdatedAt: null
      }
    });

    console.log('✅ Resume deleted:', { userId: req.user.userId });

    res.json({ message: 'Resume deleted' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== AVATAR ROUTES ====================

// POST /profile/avatar - Upload avatar
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Delete old avatar if exists
    const existingProfile = await prisma.profile.findUnique({ where: { userId: req.user.userId } });
    if (existingProfile?.avatar) {
      const oldPath = path.join(__dirname, '..', existingProfile.avatar);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const profile = await prisma.profile.upsert({
      where: { userId: req.user.userId },
      update: { avatar: avatarUrl },
      create: {
        userId: req.user.userId,
        avatar: avatarUrl
      }
    });

    console.log('✅ Avatar uploaded:', { userId: req.user.userId });

    res.json({ message: 'Avatar uploaded', avatar: avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /profile/avatar - Delete avatar
router.delete('/avatar', authMiddleware, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user.userId } });

    if (!profile || !profile.avatar) {
      return res.status(404).json({ message: 'No avatar found' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '..', profile.avatar);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.profile.update({
      where: { userId: req.user.userId },
      data: { avatar: null }
    });

    console.log('✅ Avatar deleted:', { userId: req.user.userId });

    res.json({ message: 'Avatar deleted' });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
