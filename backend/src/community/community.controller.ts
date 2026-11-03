import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CommunityPostsService } from './community-posts.service.js';
import { CommunityCommentsService } from './community-comments.service.js';
import { CreateCommunityPostDto } from './dto/create-community-post.dto.js';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto.js';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  type AuthenticatedRequest,
  type MaybeAuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';

@Controller('pois/:poiId/community-posts')
export class CommunityController {
  constructor(
    private readonly postsService: CommunityPostsService,
    private readonly commentsService: CommunityCommentsService,
    private readonly moderation: ModerationService,
  ) {}

  // Posting and replying need an account; reading the board doesn't.
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('poiId') poiId: string,
    @Body() dto: CreateCommunityPostDto,
  ) {
    await this.moderation.assertCanPost(poiId, request.userId);
    return this.postsService.create(poiId, request.userId, dto);
  }

  // Signed in, what the member reported or whose author they hid is left out.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findForPoi(
    @Req() request: MaybeAuthenticatedRequest,
    @Param('poiId') poiId: string,
  ) {
    return this.moderation.visibleFor(
      request.userId,
      'post',
      await this.postsService.findForPoi(poiId),
    );
  }

  @Get(':postId')
  findOne(@Param('postId') postId: string) {
    return this.postsService.findOne(postId);
  }

  @Post(':postId/comments')
  @UseGuards(JwtAuthGuard)
  async createComment(
    @Req() request: AuthenticatedRequest,
    @Param('poiId') poiId: string,
    @Param('postId') postId: string,
    @Body() dto: CreateCommunityCommentDto,
  ) {
    await this.moderation.assertCanPost(poiId, request.userId);
    return this.commentsService.create(postId, request.userId, dto);
  }

  @Get(':postId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async findComments(
    @Req() request: MaybeAuthenticatedRequest,
    @Param('postId') postId: string,
  ) {
    return this.moderation.visibleFor(
      request.userId,
      'comment',
      await this.commentsService.findForPost(postId),
    );
  }

  // Moderation.
  @Delete(':postId')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  removePost(@Param('poiId') poiId: string, @Param('postId') postId: string) {
    return this.postsService.remove(poiId, postId);
  }

  @Delete(':postId/comments/:commentId')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  removeComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.remove(postId, commentId);
  }
}
