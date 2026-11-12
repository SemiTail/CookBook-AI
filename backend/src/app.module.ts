import {RecipeNotesController} from './users/recipe-notes.controller';
import {CollectionsController} from './users/collections.controller';
import {RepostsController} from './users/reposts.controller';
import {ProfileCardService} from './users/profile-card.service';
import {LifecycleController} from './users/lifecycle.controller';
import {ReportsController} from './users/reports.controller';
import {SupportController} from './users/support.controller';
import {ManagementService} from './users/management.service';
import {ManagementController} from './users/management.controller';
import {ActivityController} from './users/activity.controller';
import {SocialController} from "./users/social.controller";
import {AccountController} from "./users/account.controller";
import { PhotosController } from "./recipes/photos.controller";
import { LibraryController } from "./users/library.controller";
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
    LibraryController,
    AccountController,
    CollectionsController,
    RecipeNotesController,
    SocialController,
    ManagementController,
    ActivityController,
    RepostsController,
    LifecycleController,
    ReportsController,
    SupportController,
    RecipesController,
    PhotosController,
    IngredientsController,
    FridgeController,
    RecommendationsController,
    AssistantController,
  ],
  providers: [ProfileCardService, ManagementService, AssistantService, GeminiService],
})
export class AppModule {}
