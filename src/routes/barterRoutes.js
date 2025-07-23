import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  sendProposal,
  getSentProposals,
  getReceivedProposals,
  updateProposalStatus
} from '../controllers/barterController.js';

const router = express.Router();

router.post('/proposals', authMiddleware, sendProposal);
router.get('/proposals/sent/:userId',authMiddleware, getSentProposals);
router.get('/proposals/received/:userId',authMiddleware, getReceivedProposals);
router.patch('/proposals/:proposalId', authMiddleware, updateProposalStatus);

export default router;
