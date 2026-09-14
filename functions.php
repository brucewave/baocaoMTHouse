<?php
/**
 * MT HOUSE — Hệ thống báo cáo công việc
 * Phần nối ứng dụng tĩnh vào WordPress: nạp CSS/JS, chỉ đường tới thư mục ảnh,
 * và tuỳ chọn bắt đăng nhập WordPress trước khi vào.
 *
 * @package mthouse-baocao
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MTH_BAOCAO_VERSION', '1.0.0' );

/**
 * Bắt đăng nhập WordPress trước khi xem trang báo cáo.
 *
 * Mặc định TẮT, vì dữ liệu của ứng dụng nằm trong trình duyệt của từng người
 * chứ không nằm trên máy chủ — người lạ mở vào chỉ thấy dữ liệu mẫu của chính họ.
 *
 * Muốn bật thì thêm dòng sau vào wp-config.php:
 *     define( 'MTH_BAOCAO_REQUIRE_LOGIN', true );
 * Khi bật, mỗi nhân viên cần một tài khoản WordPress để vào được trang.
 */
function mth_baocao_maybe_require_login() {
	if ( ! defined( 'MTH_BAOCAO_REQUIRE_LOGIN' ) || ! MTH_BAOCAO_REQUIRE_LOGIN ) {
		return;
	}
	if ( is_user_logged_in() || is_admin() ) {
		return;
	}
	// Bỏ qua các trang hệ thống để không tạo vòng lặp chuyển hướng.
	if ( isset( $GLOBALS['pagenow'] ) && in_array( $GLOBALS['pagenow'], array( 'wp-login.php', 'wp-register.php' ), true ) ) {
		return;
	}
	$current = home_url( add_query_arg( null, null ) );
	wp_safe_redirect( wp_login_url( $current ) );
	exit;
}
add_action( 'template_redirect', 'mth_baocao_maybe_require_login' );

/**
 * Khai báo năng lực của theme.
 */
function mth_baocao_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'html5', array( 'style', 'script' ) );
	add_theme_support( 'custom-logo', array(
		'height'      => 350,
		'width'       => 480,
		'flex-height' => true,
		'flex-width'  => true,
	) );
	load_theme_textdomain( 'mthouse-baocao', get_template_directory() . '/languages' );
}
add_action( 'after_setup_theme', 'mth_baocao_setup' );

/**
 * Ẩn thanh quản trị ở mặt trước — ứng dụng có thanh trên cùng dính,
 * để thêm thanh của WordPress sẽ bị chồng lên nhau.
 */
add_filter( 'show_admin_bar', '__return_false' );

/**
 * Nạp CSS và JS.
 *
 * Thứ tự bắt buộc: utils → store / charts → app.
 * Dùng filemtime() làm số phiên bản để mỗi lần sửa tệp là trình duyệt
 * tải lại ngay, không phải xoá cache thủ công.
 */
function mth_baocao_assets() {
	$dir = get_template_directory();
	$uri = get_template_directory_uri();

	$ver = function ( $rel ) use ( $dir ) {
		$path = $dir . '/' . ltrim( $rel, '/' );
		return file_exists( $path ) ? (string) filemtime( $path ) : MTH_BAOCAO_VERSION;
	};

	wp_enqueue_style( 'mth-baocao', $uri . '/css/app.css', array(), $ver( 'css/app.css' ) );

	wp_enqueue_script( 'mth-utils',  $uri . '/js/utils.js',  array(), $ver( 'js/utils.js' ),  true );
	wp_enqueue_script( 'mth-store',  $uri . '/js/store.js',  array( 'mth-utils' ), $ver( 'js/store.js' ),  true );
	wp_enqueue_script( 'mth-charts', $uri . '/js/charts.js', array( 'mth-utils' ), $ver( 'js/charts.js' ), true );
	wp_enqueue_script( 'mth-quote',  $uri . '/js/quote.js',  array( 'mth-utils', 'mth-store' ), $ver( 'js/quote.js' ), true );
	wp_enqueue_script( 'mth-app',    $uri . '/js/app.js',    array( 'mth-utils', 'mth-store', 'mth-charts', 'mth-quote' ), $ver( 'js/app.js' ), true );

	// Ứng dụng nạp ảnh theo đường dẫn tương đối khi chạy độc lập;
	// trong WordPress phải chỉ rõ thư mục assets của theme.
	wp_add_inline_script(
		'mth-utils',
		'window.MTH_ASSETS = ' . wp_json_encode( trailingslashit( $uri . '/assets' ) ) . ';',
		'before'
	);
}
add_action( 'wp_enqueue_scripts', 'mth_baocao_assets' );

/**
 * Favicon và màu thanh địa chỉ trên di động.
 */
function mth_baocao_head() {
	$uri = get_template_directory_uri();
	echo '<link rel="icon" href="' . esc_url( $uri . '/assets/logo.png' ) . '" type="image/png">' . "\n";
	echo '<meta name="theme-color" content="#D8451C">' . "\n";
	echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' . "\n";
}
add_action( 'wp_head', 'mth_baocao_head', 1 );

/**
 * Tên trang hiển thị trên tab trình duyệt.
 */
function mth_baocao_title( $parts ) {
	$parts['title'] = __( 'Hệ thống báo cáo công việc', 'mthouse-baocao' );
	return $parts;
}
add_filter( 'document_title_parts', 'mth_baocao_title' );

/**
 * Không cho công cụ tìm kiếm lập chỉ mục — đây là công cụ nội bộ.
 */
function mth_baocao_noindex() {
	echo '<meta name="robots" content="noindex, nofollow">' . "\n";
}
add_action( 'wp_head', 'mth_baocao_noindex', 1 );

/**
 * Bỏ những thứ WordPress tự chèn mà ứng dụng không dùng, cho trang nhẹ hơn.
 */
function mth_baocao_trim_head() {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'wp_head', 'wp_generator' );
	remove_action( 'wp_head', 'rsd_link' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'feed_links_extra', 3 );
}
add_action( 'init', 'mth_baocao_trim_head' );
