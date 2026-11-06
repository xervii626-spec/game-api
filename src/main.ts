import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RgsExceptionFilter } from './common/filters/rgs-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Render / proxies: real client IP in X-Forwarded-For
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  const corsOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3003")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  app.useGlobalFilters(new RgsExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // RGS test tools may send extra fields; reject only unknown would break their client
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Casino Game API')
    .setDescription('BetConstruct RGS Partner / Wallet API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));


  const port = Number(process.env.PORT ?? 5000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}

bootstrap();
