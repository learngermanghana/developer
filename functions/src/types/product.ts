export type ProductItemType = 'product' | 'service' | 'made_to_order'

export type ProductReadModel = {
  id: string
  storeId: string
  name: string
  price: number | null
  stockCount: number | null
  itemType: ProductItemType
  imageUrl: string | null
  imageAlt: string | null
  updatedAt: FirebaseFirestore.Timestamp | null
}
