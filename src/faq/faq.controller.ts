import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FaqService } from './faq.service';

@ApiTags('faqs')
@Controller('faqs')
export class FaqController {
  constructor(private readonly faqs: FaqService) {}

  /** Active FAQs for chat chips (no text input). */
  @Get()
  list() {
    return this.faqs.listActive();
  }
}
