import { CommunityController } from "./users/community.controller";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { UsersController } from "./users/users.controller";
import { RecipesController } from "./recipes/recipes.controller";
import { IngredientsController } from "./ingredients/ingredients.controller";
import { FridgeController } from "./fridge/fridge.controller";
import { RecommendationsController } from "./recommendations/recommendations.controller";
import { AssistantController } from "./assistant/assistant.controller";
import { AssistantService } from "./assistant/assistant.service";
import { GeminiService } from "./assistant/gemini.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    UsersController,
    CommunityController,
    RecipesController,
    IngredientsController,
    FridgeController,
    RecommendationsController,
    AssistantController,
  ],
  providers: [AssistantService, GeminiService],
})
export class AppModule {}
