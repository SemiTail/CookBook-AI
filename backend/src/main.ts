import "reflect-metadata";
import { access } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
  if (process.env.FRONTEND_DIST) {
    await serveFrontend(app, process.env.FRONTEND_DIST);
  }
  const port = Number(process.env.PORT ?? "3001");
  await app.listen(port, process.env.HOST ?? "127.0.0.1");
  console.log(`CookBook AI API: ${await app.getUrl()}/api/v1/health`);
}

async function serveFrontend(app: NestExpressApplication, directory: string): Promise<void> {
  const root = resolve(directory);
  const index = resolve(root, "index.html");
  await access(index);
  app.useStaticAssets(root, { index: false, redirect: false });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isPageRequest = request.method === "GET" || request.method === "HEAD";
    if (
      !isPageRequest ||
      /^\/api(?:\/|$)/i.test(request.path) ||
      extname(request.path) ||
      !request.accepts("html")
    ) {
      next();
      return;
    }
    response.sendFile(index, (error) => {
      if (error) next(error);
    });
  });
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start CookBook AI API:", error);
  process.exitCode = 1;
});
