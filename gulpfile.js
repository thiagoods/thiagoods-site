/*Required Packages*/
var gulp = require('gulp'),
	browserSync = require('browser-sync'),
	concat = require('gulp-concat'),
	csslint = require('gulp-csslint'),
	cssnano = require('gulp-cssnano'),
	del = require('del'),
	frontMatter = require('front-matter'),
	jade = require('jade'),
	jshint = require('gulp-jshint'),
	marked = require('marked'),
	rename = require('gulp-rename'),
	replace = require('gulp-replace'),
	sass = require('gulp-sass'),
	uglify = require('gulp-uglify'),
	fs = require('fs'),
	path = require('path'),
	vinylMap = require('vinyl-map');

/*Configuration Files*/
var csslintConfig = require('./.csslintrc.json'),
	cssNanoConfig = {autoprefixer: {browsers: ['last 2 version', 'ie 10', 'ios 7', 'android 4']}, discardUnused: false, minifyFontValues: false},
	jadeOpts = { basedir: './', pretty: '' },
	jshintConfig = require('./.jshintrc.json'),
	version = Date.now();

/* helper functions */
var renderPage = function(content, filename) {
	var jadeTemplate = jade.compileFile(filename, jadeOpts);
	var data = {'posts': JSON.parse(fs.readFileSync('./data/blog.json', { encoding: 'utf8' }))}
	return jadeTemplate(data);
};

var renderPost = function(content, filename) {
	var jadeTemplate = jade.compileFile('./pages/blog/post.jade', jadeOpts);
	var parsed = frontMatter(String(content));
	var data = parsed.attributes;
	var body = parsed.body;
	body = marked.parse(body);
	data.content = body;
	data.filename = filename;
	data.posts = JSON.parse(fs.readFileSync('./data/blog.json', { encoding: 'utf-8' }));
	return jadeTemplate(data);
};

var postsdb = function(blogPath) {
	var dateParser = function(date) {
		date = date.split('/');
		date['aux'] = date [0];
		date[0] = date[1];
		date[1] = date['aux'];
		date = date.join('-');
		return Date.parse(date);
	};
	var DB = [];
	var files = fs.readdirSync(blogPath);
	files.forEach(function(filename){
		if(path.extname(filename) == '.md'){
			var file = fs.readFileSync(blogPath + filename);
			var content = frontMatter(String(file));
			DB.push(content.attributes);
		}
	});
	DB.sort(function (a,b) {
		return dateParser(a.date) < dateParser(b.date);
	});
	var stream = fs.createWriteStream(path.join(__dirname, '/data/blog.json'));
	stream.on('open', function(){
		stream.write(JSON.stringify(DB));
		stream.end();
	});
};

/*Tasks*/
	gulp.task('clear', function(cb) {
		return del([
			'./public/**/*',
			'./data/blog.json'
		], cb);
	});

	gulp.task('db', function(cb){
		postsdb('./pages/blog/');
		cb();
	});

	gulp.task('posts', ['db'], function() {
		return gulp.src('./pages/blog/*.md')
			.pipe(vinylMap(renderPost))
			.pipe(replace('{{version}}', version))
			.pipe(rename(function(path){
				var folder = path.basename;
				var fileName = 'index';
				path.dirname = folder;
				path.basename = fileName;
				path.extname = '.html';
			}))
			.pipe(gulp.dest('./public/blog'))
			.pipe(browserSync.stream());
	});

	gulp.task('html', ['db'], function(){
		return gulp.src(['./pages/**/*.jade', '!./pages/sitemap.jade', '!./pages/blog/post.jade'])
			.pipe(vinylMap(renderPage))
			.pipe(replace('{{version}}', version))
			.pipe(rename(function(path){
				if(path.basename != '404' && path.basename != 'index') {
					var folder = path.basename;
					var fileName = 'index';
					path.dirname = folder;
					path.basename = fileName;
				}
				path.extname = '.html';
			}))
			.pipe(gulp.dest('./public'))
			.pipe(browserSync.stream());
	});

	gulp.task('sitemap', function(){
		return gulp.src('./pages/sitemap.jade')
			.pipe(vinylMap(renderPage))
			.pipe(rename({extname: '.xml'}))
			.pipe(gulp.dest('./public'))
	});

	gulp.task('css', function(){
		return gulp.src('./css/site.scss')
			.pipe(sass())
			.pipe(replace('{{version}}', version))
			.pipe(csslint(csslintConfig))
			.pipe(csslint.formatter())
			.pipe(gulp.dest('./public/css'))
			.pipe(cssnano(cssNanoConfig))
			.pipe(rename({ suffix: '.min' }))
			.pipe(gulp.dest('./public/css'))
			.pipe(browserSync.stream());
	});

	gulp.task('js', function(){
		return gulp.src(require('./js/modules.js'))
			.pipe(jshint(jshintConfig))
			.pipe(jshint.reporter('default'))
			.pipe(jshint.reporter('fail'))
			.pipe(concat('site.js'))
			.pipe(gulp.dest('./public/js'))
			.pipe(uglify())
			.pipe(rename({ suffix: '.min' }))
			.pipe(gulp.dest('./public/js'))
			.pipe(browserSync.stream());
	});

	gulp.task('static', function() {
		return gulp.src(['./static/**/*', './static/.gitignore'])
			.pipe(gulp.dest('./public'))
			.pipe(browserSync.stream());
	});

	gulp.task('browsersync', function() {
		browserSync({
			ghostMode: {
				clicks: true,
				forms: true,
				location: true,
				scroll: true
			},
			server: {
				baseDir: './public'
			},
			watchTask: true
		});
	});

	gulp.task('default', ['clear'], function() {
		gulp.start('html', 'posts', 'css', 'js', 'static', 'sitemap');
	});

	gulp.task('dev', ['html', 'css', 'js', 'static', 'posts'], function(){
		gulp.start('browsersync');
		gulp.watch('./+(data|includes|mixins|pages|templates)/**/*.jade', { debounceDelay: 400 }, ['html', browserSync.reload])
		gulp.watch('./pages/blog/*.md', ['posts'])
		gulp.watch('./css/*.scss', ['css'])
		gulp.watch('./js/*.js', ['js'])
		gulp.watch('./static/**/*', ['static'])
	});
