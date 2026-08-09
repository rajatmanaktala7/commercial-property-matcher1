import { Router } from 'express';
import { teamController } from '../controllers/team.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', teamController.getTeam);
router.get('/activity', teamController.getActivity);

export default router;
