import {
  Controller,
  Get,
  type INestApplication,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { InternalErrorFilter } from './internal-error.filter.js'

@Controller()
class ExampleController {
  @Get('broken')
  broken() {
    throw new Error('connect to mongodb://admin:secret@db failed')
  }

  @Get('missing')
  missing() {
    throw new NotFoundException('Chat not found')
  }
}

describe('InternalErrorFilter', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExampleController],
    }).compile()

    app = module.createNestApplication({ logger: false })
    app.useGlobalFilters(new InternalErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('hides unexpected errors behind a generic 500', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})

    const response = await request(app.getHttpServer())
      .get('/broken')
      .expect(500)

    expect(response.body).toEqual({
      message: 'Internal server error',
      statusCode: 500,
    })
    expect(JSON.stringify(response.body)).not.toContain('secret')
  })

  it('passes HTTP exceptions through unchanged', async () => {
    await request(app.getHttpServer()).get('/missing').expect(404, {
      error: 'Not Found',
      message: 'Chat not found',
      statusCode: 404,
    })
  })
})
