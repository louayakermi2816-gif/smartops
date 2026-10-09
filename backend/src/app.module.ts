import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnomalyModule } from './anomaly/anomaly.module';

@Module({
  imports: [
    // Step 1 — Load .env file globally across the entire app
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Step 2 — Connect to MongoDB using credentials from .env
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: `mongodb://${configService.get('MONGO_USERNAME')}:${configService.get('MONGO_PASSWORD')}@localhost:27017/${configService.get('MONGO_DATABASE')}?authSource=admin`,
      }),
      inject: [ConfigService],
    }),

    AnomalyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }