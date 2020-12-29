# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 0.1.1 (2020-12-29)


### Features

* add other badges to the list ([3be0d1c](https://github.com/kleros/t2cr-to-ipfs/commit/3be0d1ccb1ba86cca7e1942d0c4fd3581f059641))
* allow diacritics in token name and fix [#1](https://github.com/kleros/t2cr-to-ipfs/issues/1) ([9a05e5c](https://github.com/kleros/t2cr-to-ipfs/commit/9a05e5cbfbb6b803a41755286be9de1051ff4659))
* cache images and improve error handling ([e014130](https://github.com/kleros/t2cr-to-ipfs/commit/e014130aba4275bfecb281caca3320810ceeffa0))
* calculate new version from lists ([a59e27a](https://github.com/kleros/t2cr-to-ipfs/commit/a59e27ace74293feed290ed8c0dc8d5e9bf7ce9f))
* fetch remote and upload new list ([5b20d9c](https://github.com/kleros/t2cr-to-ipfs/commit/5b20d9c4387dbb3903a7c0b56bf51cfc52984c82))
* handle missing decimals and build initial list object ([d14c6e7](https://github.com/kleros/t2cr-to-ipfs/commit/d14c6e76e8f7f215a4cab58b308bc460af651afb))
* include list logo in json file ([5c1ba23](https://github.com/kleros/t2cr-to-ipfs/commit/5c1ba2392d8eda36355b16eafbf3c7e15438299a))
* initial ens handling ([8667c53](https://github.com/kleros/t2cr-to-ipfs/commit/8667c531ccdce871798bbc443c2942df950c97e1))
* optionally, also pin hash to pinata.cloud ([562bd3e](https://github.com/kleros/t2cr-to-ipfs/commit/562bd3e9c8fcfd7552926d6464740f7bac8a8586))
* output to file ([8859d7c](https://github.com/kleros/t2cr-to-ipfs/commit/8859d7c5f93017e9e96438cfc4cd5b650dac4285))
* prepare for use with cron ([81d8cb5](https://github.com/kleros/t2cr-to-ipfs/commit/81d8cb5209067cb1765b8476639b11163e0f1928))
* pull tokens from t2cr ([61844ac](https://github.com/kleros/t2cr-to-ipfs/commit/61844ac9a3ccf7712936704e6505c849f206fc51))
* set ens name after uploading list ([6d02393](https://github.com/kleros/t2cr-to-ipfs/commit/6d023931d89f23177267c2109ca139047a6c9cc9))
* shorten erc20 badge name ([8cb69ce](https://github.com/kleros/t2cr-to-ipfs/commit/8cb69ce6666962d4b09d2cce17e8e3deeaed31bf))
* shrink image from t2cr and upload to ipfs ([284501e](https://github.com/kleros/t2cr-to-ipfs/commit/284501e5bee772060c6e0f91966a75bb03db46f1))
* take token decimal places from curate, if possible ([99bd933](https://github.com/kleros/t2cr-to-ipfs/commit/99bd93301e705537b8724405771ba795e0aa778e))
* update erc20 badge description ([ede08ed](https://github.com/kleros/t2cr-to-ipfs/commit/ede08ed5457a9bddde0511be4146e1b313df632d))
* validate generated object against @uniswap/token-lists schema ([6a6a8e1](https://github.com/kleros/t2cr-to-ipfs/commit/6a6a8e1089f16ffb36c1a8b6aa20102400b4ed4e))
* validate list file against uniswap json schema ([fee9d0d](https://github.com/kleros/t2cr-to-ipfs/commit/fee9d0d0e0fff26a324d333aaf04de22aaf6b3db))


### Bug Fixes

* build before running script ([9667926](https://github.com/kleros/t2cr-to-ipfs/commit/9667926ac8d733987d573b3a20247666c62eb6f3))
* expected node version ([8cbe656](https://github.com/kleros/t2cr-to-ipfs/commit/8cbe656db718e3ead8be8ac27a7cf173b0466295))
* infura timeouts and outdate cache ([7264f70](https://github.com/kleros/t2cr-to-ipfs/commit/7264f700cf2ff0b0a4e70ecf9699d2d7aa632a4d))
* invalid token names should not prevent new lists from being published ([c38235a](https://github.com/kleros/t2cr-to-ipfs/commit/c38235adff5eb6ef4729021e625a9ce05ba5b73e))
* missing empty string ([b6df940](https://github.com/kleros/t2cr-to-ipfs/commit/b6df9403606378a1f042e11779a401510b0d7e95))
* missing fetch definition ([ca107d0](https://github.com/kleros/t2cr-to-ipfs/commit/ca107d053d2f9fdfd074e92d0da93561cf77269d))
* prevent tokens that fail ticker regex from publishing the list ([0ccfcf1](https://github.com/kleros/t2cr-to-ipfs/commit/0ccfcf17d530fe97da89d526c8253298b8acdb64))
* regex issue with badge description ([1ac9bcc](https://github.com/kleros/t2cr-to-ipfs/commit/1ac9bcca422e7890d7b8b4db128aa44c623d7702))
* update node version and fix log output ([868a908](https://github.com/kleros/t2cr-to-ipfs/commit/868a908a9772936ccd8060a11d06a49f10edd0e5))
