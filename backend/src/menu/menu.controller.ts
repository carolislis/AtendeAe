import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { MenuService } from './menu.service';
import { BillingGuard } from '../auth/billing.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menu: MenuService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Get('categories')
  listCategories(@Request() req: { user: { establishmentId: string } }) {
    return this.menu.listCategories(req.user.establishmentId);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Post('categories')
  createCategory(
    @Request() req: { user: { establishmentId: string } },
    @Body() body: { name: string; order?: number },
  ) {
    return this.menu.createCategory(req.user.establishmentId, body.name, body.order ?? 0);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Put('categories/:id')
  updateCategory(
    @Request() req: { user: { establishmentId: string } },
    @Param('id') id: string,
    @Body() body: { name: string; order?: number },
  ) {
    return this.menu.updateCategory(req.user.establishmentId, id, body.name, body.order ?? 0);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Delete('categories/:id')
  deleteCategory(
    @Request() req: { user: { establishmentId: string } },
    @Param('id') id: string,
  ) {
    return this.menu.deleteCategory(req.user.establishmentId, id);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Get('products')
  listProducts(@Request() req: { user: { establishmentId: string } }) {
    return this.menu.listProducts(req.user.establishmentId);
  }

  /** Cardápio público: retorna categorias, produtos e tema pelo cardapioId (sem auth). */
  @Get('public')
  getPublicMenu(@Query('id') id: string) {
    const establishmentId = this.config.getEstablishmentIdByCardapioId(id || '');
    if (!id || !establishmentId) {
      throw new NotFoundException('Link do cardápio inválido');
    }
    return {
      categories: this.menu.listCategories(establishmentId),
      products: this.menu.listProducts(establishmentId),
      theme: this.config.getCardapioTheme(establishmentId),
    };
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Post('products')
  createProduct(
    @Request() req: { user: { establishmentId: string } },
    @Body()
    body: {
      name: string;
      description?: string;
      price: number;
      categoryId: string;
      order?: number;
      imageUrl?: string;
    },
  ) {
    return this.menu.createProduct(req.user.establishmentId, body);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Put('products/:id')
  updateProduct(
    @Request() req: { user: { establishmentId: string } },
    @Param('id') id: string,
    @Body()
    body: {
      name: string;
      description?: string;
      price: number;
      categoryId: string;
      order?: number;
      imageUrl?: string;
    },
  ) {
    return this.menu.updateProduct(req.user.establishmentId, id, body);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Delete('products/:id')
  deleteProduct(
    @Request() req: { user: { establishmentId: string } },
    @Param('id') id: string,
  ) {
    return this.menu.deleteProduct(req.user.establishmentId, id);
  }
}
