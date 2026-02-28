import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { MenuService } from './menu.service';
import { MenuItem } from './models/menu-item.model';

@Resolver(() => MenuItem)
export class MenuResolver {
  constructor(@Inject(MenuService) private readonly menuService: MenuService) {}

  @Query(() => [MenuItem], { description: 'Return all available menu items' })
  menuItems() {
    return this.menuService.findAll();
  }
}
