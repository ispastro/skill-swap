

import prisma from '../config/db.js';


export const sendProposal = async(req, res) =>{
    const {fromUserId, toUserId , offer, request} =req.body;

    try{
        const proposal  = await prisma.barterProposal.create({
            data: {
                fromUserId,
                toUserId,
                offer,
                request,
            },
        });
        res.status(201).json(proposal);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}



export const getSentProposals = async (req, res) => {   
        const {userId}= req.params;

        try{
            const proposals= await prisma.barterProposal.findMany({
                where: {                    fromUserId: userId,
                },
                include:{
                    toUser: true
                }
            });
            res.status(200).json(proposals);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });

        }


    }


export const getReceivedProposals = async (req, res) => {
    const {userId} = req.params;

    try {
        const proposals = await prisma.barterProposal.findMany({
            where: {
                toUserId: userId,
            },
            include: {
                fromUser: true
            }
        });
        res.status(200).json(proposals);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}


export const    updateProposalStatus = async (req, res) => {
    const { proposalId, status } = req.body;
    if(!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const updatedProposal = await prisma.barterProposal.update({
            where: { id: proposalId },
            data: { status },
        });
        res.status(200).json(updatedProposal);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}