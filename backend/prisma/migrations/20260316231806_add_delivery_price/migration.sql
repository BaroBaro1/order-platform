-- CreateTable
CREATE TABLE `DeliveryPrice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company` VARCHAR(191) NOT NULL,
    `wilaya` VARCHAR(191) NOT NULL,
    `homePrice` INTEGER NOT NULL,
    `deskPrice` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
