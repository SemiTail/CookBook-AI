import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  const origins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  if (process.env.FRONTEND_ORIGIN && !origins.includes(process.env.FRONTEND_ORIGIN)) {
    origins.push(process.env.FRONTEND_ORIGIN);
  }
  app.enableCors({ origin: origins, credentials: false });
  const port = Number(process.env.PORT ?? "3001");
  await app.listen(port, process.env.HOST ?? "127.0.0.1");
  console.log(`CookBook AI API: ${await app.getUrl()}/api/v1/health`);
}
bootstrap().catch((error: unknown) => {
  console.error("Failed to start CookBook AI API:", error);
  process.exitCode = 1;
});
