import  prisma  from '../config/db';
import  winston from 'winston';
import  { calculateMatchScore } from './matchController';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Notify users of new matches after profile update
const notifyNewMatches = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, skillsHave: true, skillsWant: true },
    });

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allUsers = await prisma.user.findMany({
      where: { id: { not: currentUser.id } },
      select: { id: true, username: true, skillsHave: true, skillsWant: true },
    });

    const matches = allUsers
      .map((user) => {
        const { matchScore, matchedHave, matchedWant } = calculateMatchScore(currentUser, user);
        if (matchScore > 0) {
          return { userId: user.id, username: user.username, matchScore, matchedHave, matchedWant };
        }
        return null;
      })
      .filter(Boolean);

    if (req.io && matches.length > 0) {
      matches.forEach((match) => {
        req.io.to(match.userId).emit('newMatch', {
          match: {
            id: currentUser.id,
            username: currentUser.username,
            matchScore: match.matchScore,
            matchedHave: match.matchedHave,
            matchedWant: match.matchedWant,
          },
          message: `You have a new match with ${currentUser.username} (${match.matchScore}% match)`,
        });
      });
    }

    logger.info('Notified new matches', { userId: req.user.id, matchCount: matches.length });
    res.status(200).json({ message: 'Notifications sent', matchCount: matches.length });
  } catch (error) {
    logger.error('Notify matches error', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { notifyNewMatches };