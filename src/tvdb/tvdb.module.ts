import { Module } from '@nestjs/common'

import { TvdbClient } from './tvdb.client.js'
import { TvdbService } from './tvdb.service.js'
import { TvdbTools } from './tvdb.tools.js'

@Module({
  exports: [TvdbTools],
  providers: [TvdbClient, TvdbService, TvdbTools],
})
export class TvdbModule {}
