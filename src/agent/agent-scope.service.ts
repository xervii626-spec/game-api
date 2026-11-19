import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Resolve agent trees and owned player ids for scoped queries. */
@Injectable()
export class AgentScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Self + all descendant agent ids (for master: includes sub-agents). */
  async agentIdsInTree(rootAgentId: number): Promise<number[]> {
    const ids = new Set<number>([rootAgentId]);
    let frontier = [rootAgentId];
    while (frontier.length) {
      const children = await this.prisma.adminUser.findMany({
        where: { parentId: { in: frontier }, isActive: true },
        select: { id: true },
      });
      frontier = [];
      for (const c of children) {
        if (!ids.has(c.id)) {
          ids.add(c.id);
          frontier.push(c.id);
        }
      }
    }
    return [...ids];
  }

  async playerIdsForAgent(agentId: number, role: string): Promise<number[]> {
    const agentIds =
      role === 'master_agent'
        ? await this.agentIdsInTree(agentId)
        : [agentId];

    const players = await this.prisma.player.findMany({
      where: { agentId: { in: agentIds } },
      select: { id: true },
    });
    return players.map((p) => p.id);
  }

  async assertPlayerOwned(
    agentId: number,
    role: string,
    playerId: number,
  ): Promise<boolean> {
    const ids = await this.playerIdsForAgent(agentId, role);
    return ids.includes(playerId);
  }
}
