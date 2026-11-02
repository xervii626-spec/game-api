import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  const corsOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3003")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
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
