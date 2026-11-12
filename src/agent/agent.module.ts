import { Module } from '@nestjs/common'

import { TvdbModule } from '../tvdb/tvdb.module.js'
import { AgentService } from './agent.service.js'

@Module({
  exports: [AgentService],
  imports: [TvdbModule],
  providers: [AgentService],
})
export class AgentModule {}
