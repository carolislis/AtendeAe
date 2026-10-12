import { Injectable, NotFoundException } from '@nestjs/common';

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  order: number;
  imageUrl?: string;
}

interface EstablishmentMenuState {
  categories: Category[];
  products: Product[];
  catId: number;
  prodId: number;
}

@Injectable()
export class MenuService {
  private byEstablishment = new Map<string, EstablishmentMenuState>();

  private ensure(establishmentId: string): EstablishmentMenuState {
    let state = this.byEstablishment.get(establishmentId);
    if (!state) {
      state = { categories: [], products: [], catId: 0, prodId: 0 };
      this.byEstablishment.set(establishmentId, state);
    }
    return state;
  }

  private nextCatId(establishmentId: string): string {
    const state = this.ensure(establishmentId);
    state.catId += 1;
    return `cat-${state.catId}`;
  }

  private nextProdId(establishmentId: string): string {
    const state = this.ensure(establishmentId);
    state.prodId += 1;
    return `prod-${state.prodId}`;
  }

  listCategories(establishmentId: string): Category[] {
    const state = this.ensure(establishmentId);
    return [...state.categories].sort((a, b) => a.order - b.order);
  }

  createCategory(establishmentId: string, name: string, order: number): Category {
    const state = this.ensure(establishmentId);
    const c: Category = { id: this.nextCatId(establishmentId), name, order };
    state.categories.push(c);
    return c;
  }

  updateCategory(establishmentId: string, id: string, name: string, order: number): Category {
    const state = this.ensure(establishmentId);
    const c = state.categories.find((x) => x.id === id);
    if (!c) throw new NotFoundException('Categoria não encontrada');
    c.name = name;
    c.order = order;
    return c;
  }

  deleteCategory(establishmentId: string, id: string): void {
    const state = this.ensure(establishmentId);
    const i = state.categories.findIndex((x) => x.id === id);
    if (i === -1) throw new NotFoundException('Categoria não encontrada');
    state.categories.splice(i, 1);
    state.products = state.products.filter((p) => p.categoryId !== id);
  }

  listProducts(establishmentId: string): Product[] {
    const state = this.ensure(establishmentId);
    return [...state.products].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  createProduct(establishmentId: string, body: Omit<Product, 'id' | 'order'> & { order?: number }): Product {
    const state = this.ensure(establishmentId);
    const order = body.order ?? state.products.filter((p) => p.categoryId === body.categoryId).length;
    const p: Product = {
      id: this.nextProdId(establishmentId),
      name: body.name,
      description: body.description,
      price: body.price,
      categoryId: body.categoryId,
      order,
      imageUrl: body.imageUrl,
    };
    state.products.push(p);
    return p;
  }

  updateProduct(
    establishmentId: string,
    id: string,
    body: Partial<Omit<Product, 'id'>> & { name: string; price: number; categoryId: string },
  ): Product {
    const state = this.ensure(establishmentId);
    const p = state.products.find((x) => x.id === id);
    if (!p) throw new NotFoundException('Produto não encontrado');
    p.name = body.name;
    p.description = body.description;
    p.price = body.price;
    p.categoryId = body.categoryId;
    if (body.order !== undefined) p.order = body.order;
    if (body.imageUrl !== undefined) p.imageUrl = body.imageUrl;
    return p;
  }

  deleteProduct(establishmentId: string, id: string): void {
    const state = this.ensure(establishmentId);
    const i = state.products.findIndex((x) => x.id === id);
    if (i === -1) throw new NotFoundException('Produto não encontrado');
    state.products.splice(i, 1);
  }
}
